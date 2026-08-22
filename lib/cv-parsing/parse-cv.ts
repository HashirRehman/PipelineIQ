// bytes → text → structured JSON → one row update. The only place that writes
// the parse columns.
//
// Never throws: callers are background work, so failures are recorded on the
// row and returned as an outcome.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiClient } from "@/lib/ai/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import { downloadCvFile } from "@/lib/supabase/storage";
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
  /** profile_cvs.storage_path — the object key in the profile-cvs bucket, for re-parses. */
  storagePath?: string;
};

async function recordFailure(
  supabase: SupabaseClient<Database>,
  cvId: string,
  message: string,
): Promise<CvParseOutcome> {
  // parsed_data is left alone on purpose: a failed re-parse must not destroy a
  // previously good parse.
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
  // Storage reads default to the same client that writes the parse columns,
  // which is right for the cron sweep (no user session -> service role). The
  // manual re-parse route passes its USER-scoped client here so
  // storage.objects RLS is the boundary for reading the file, even though the
  // system-owned parse columns are still written with the service role.
  storageClient: SupabaseClient<Database> = supabase,
): Promise<CvParseOutcome> {
  const { cvId, fileType } = target;

  let bytes: Buffer;
  try {
    bytes =
      target.buffer ??
      (target.storagePath
        ? await downloadCvFile(storageClient, target.storagePath)
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
    // CvExtractionError messages are user-facing, so they go straight in
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
    // Rate limits land here; the sweep retries anything not 'success'.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`parseAndStoreCv: AI parse failed for CV ${cvId}`, error);
    return recordFailure(supabase, cvId, message);
  }

  const { error: writeError } = await supabase
    .from("profile_cvs")
    .update({
      // structurally Json; the generated type just can't see it
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
