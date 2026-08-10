// Backstop sweep for CVs that never got parsed.
//
// The upload path schedules a parse in after(), which is reliable but not
// guaranteed: the function instance can be torn down, Groq can be rate
// limited, or the daily token cap can be exhausted. Without a sweep those CVs
// stay 'pending' forever and nothing ever notices.
//
// Deliberately NOT folded into /api/cron/discover-jobs. Discovery is already
// the thing that exhausts Groq's daily token budget, and CV parsing must not
// inherit that fight — nor should a discovery failure be able to stop CVs
// being parsed. It is also intentionally not registered in vercel.json yet;
// scheduling it is a deployment decision, and it works as a manual endpoint
// until someone makes it.
import { NextResponse } from "next/server";
import { GroqAiClient } from "@/lib/ai/groq-client";
import { parseAndStoreCv } from "@/lib/cv-parsing/parse-cv";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

// Each CV is one Groq call, and groq-client paces itself to ~2s per call, so
// this is the number that keeps a run inside maxDuration with room for the
// file downloads. Sized the same way the discovery caps were.
const MAX_CVS_PER_RUN = 20;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Anything not 'success' is work: 'pending' (never attempted) and 'failed'
  // (attempted, retryable) alike. A permanently unreadable file will be
  // retried on every run — cheap, since extraction fails before any Groq call
  // is made, and self-healing once the file is replaced.
  const { data: pending, error } = await supabase
    .from("profile_cvs")
    .select("id, file_type, storage_path")
    .neq("parse_status", "success")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_CVS_PER_RUN);

  if (error) {
    console.error("parse-cvs: could not list unparsed CVs", error);
    return NextResponse.json({ status: "failed", error: error.message }, { status: 500 });
  }

  const aiClient = new GroqAiClient();
  let succeeded = 0;
  let failed = 0;

  // Sequential on purpose: groq-client's pacing is module-level state built
  // for a strictly sequential loop, and firing these concurrently would
  // defeat it and trigger rate limits.
  for (const cv of pending ?? []) {
    const outcome = await parseAndStoreCv(supabase, aiClient, {
      cvId: cv.id,
      fileType: cv.file_type,
      storagePath: cv.storage_path,
    });
    if (outcome.status === "success") {
      succeeded++;
    } else {
      failed++;
    }
  }

  // capped tells an operator the queue was longer than one run — the same
  // honesty the discovery summary's *Capped flags provide.
  return NextResponse.json({
    status: "completed",
    attempted: pending?.length ?? 0,
    succeeded,
    failed,
    capped: (pending?.length ?? 0) === MAX_CVS_PER_RUN,
  });
}
