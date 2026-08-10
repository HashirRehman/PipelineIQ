// Parse a stored CV and write the result back to profile_cvs.
//
// This is the orchestration step: bytes → text (extract-text.ts) → structured
// JSON (AiClient.parseCv) → one row update. It is the only place that writes
// the parse columns, so the parse_status lifecycle lives in exactly one file.
//
// It never throws. Every caller is background work — a post-response after()
// callback or a sweep loop — where an exception would either be swallowed by
// the runtime or abort the remaining CVs. Failures are recorded on the row and
// returned as an outcome instead.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiClient } from "@/lib/ai/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import { CvExtractionError, extractCvText } from "./extract-text";
import { PARSED_CV_SCHEMA_VERSION } from "./parsed-cv";

export type CvParseOutcome =
  | { status: "success"; cvId: string; skillCount: number; experienceCount: number }
  | { status: "failed"; cvId: string; error: string };

export type CvParseTarget = {
  cvId: string;
  fileType: string;
  /** The uploaded bytes, when the caller already has them in memory. */
  buffer?: Buffer;
  /** Cloudinary URL from profile_cvs.storage_path, for re-parses. */
  storagePath?: string;
};

/**
 * Downloads a stored CV.
 *
 * Only needed on the re-parse and sweep paths — the upload path passes the
 * buffer it already read for Cloudinary, so a fresh upload never makes this
 * round trip. Seeded demo rows carry dummy storage paths that aren't URLs,
 * which is a recognized state rather than an error worth retrying.
 */
async function downloadCvBytes(storagePath: string): Promise<Buffer> {
  if (!storagePath.startsWith("https://")) {
    throw new Error(
      "This CV has no downloadable file (its storage path is a placeholder, not a URL).",
    );
  }

  const response = await fetch(storagePath);
  if (!response.ok) {
    throw new Error(`Could not download the stored file (HTTP ${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function recordFailure(
  supabase: SupabaseClient<Database>,
  cvId: string,
  message: string,
): Promise<CvParseOutcome> {
  // parsed_data is deliberately left untouched. A failed *re-parse* must not
  // destroy a previously good parse — the success-implies-payload CHECK only
  // constrains rows whose status is 'success', so a 'failed' row keeping its
  // last known parse is both legal and the more useful outcome.
  const { error } = await supabase
    .from("profile_cvs")
    .update({ parse_status: "failed", parse_error: message })
    .eq("id", cvId);

  if (error) {
    console.error(`parseAndStoreCv: could not record failure for CV ${cvId}`, error);
  }

  return { status: "failed", cvId, error: message };
}

export async function parseAndStoreCv(
  supabase: SupabaseClient<Database>,
  aiClient: AiClient,
  target: CvParseTarget,
): Promise<CvParseOutcome> {
  const { cvId, fileType } = target;

  let bytes: Buffer;
  try {
    bytes =
      target.buffer ??
      (target.storagePath
        ? await downloadCvBytes(target.storagePath)
        : (() => {
            throw new Error("No file contents and no storage path to fetch them from.");
          })());
  } catch (error) {
    return recordFailure(supabase, cvId, error instanceof Error ? error.message : String(error));
  }

  let text: string;
  try {
    ({ text } = await extractCvText(bytes, fileType));
  } catch (error) {
    // CvExtractionError messages are written for a person to read (see
    // extract-text.ts), so they go straight into parse_error.
    const message =
      error instanceof CvExtractionError
        ? error.message
        : `Could not read the file: ${error instanceof Error ? error.message : String(error)}`;
    return recordFailure(supabase, cvId, message);
  }

  let parsed;
  let modelVersion: string;
  try {
    ({ parsed, modelVersion } = await aiClient.parseCv(text));
  } catch (error) {
    // Groq rate limits and daily token caps land here. The row stays
    // retryable — the sweep picks up anything not 'success'.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`parseAndStoreCv: AI parse failed for CV ${cvId}`, error);
    return recordFailure(supabase, cvId, message);
  }

  const { error: writeError } = await supabase
    .from("profile_cvs")
    .update({
      // ParsedCv is a plain nested object of primitives and arrays, which is
      // structurally Json; the generated Json type just can't see that.
      parsed_data: parsed as unknown as Json,
      parsed_at: new Date().toISOString(),
      parse_status: "success",
      parse_error: null,
      parse_model_version: modelVersion,
      parse_schema_version: PARSED_CV_SCHEMA_VERSION,
    })
    .eq("id", cvId);

  if (writeError) {
    console.error(`parseAndStoreCv: could not store the parse for CV ${cvId}`, writeError);
    return recordFailure(supabase, cvId, `Could not save the parsed result: ${writeError.message}`);
  }

  return {
    status: "success",
    cvId,
    skillCount: parsed.skills.length,
    experienceCount: parsed.experience.length,
  };
}
