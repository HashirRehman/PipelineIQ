// Module 3 — nightly job-discovery cron trigger. Excluded from the session
// middleware matcher (middleware.ts) — this route has no user session at
// all; CRON_SECRET is the actual auth boundary here, not cookies.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroqAiClient } from "@/lib/ai/groq-client";
import { acquireDiscoveryLock, releaseDiscoveryLock, runJobDiscovery } from "@/lib/cron/discover-jobs";

// Explicit, not left to the platform default — Vercel Hobby + Fluid
// Compute gives 300s as both default and hard maximum, no override
// possible. The per-run scoring/enrichment caps in discover-jobs.ts are
// the primary control keeping typical runs well under this; this is the
// outer safety backstop matching Hobby's actual ceiling.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const lockResult = await acquireDiscoveryLock(supabase);
  if (!lockResult.acquired) {
    if (lockResult.reason === "cooldown") {
      return NextResponse.json(
        { status: "skipped", reason: "cooldown", nextRunAvailableAt: lockResult.nextRunAvailableAt },
        { status: 200 },
      );
    }
    return NextResponse.json({ status: "skipped", reason: "already running" }, { status: 200 });
  }

  let completed = false;
  try {
    const summary = await runJobDiscovery(supabase, new GroqAiClient());
    completed = true;
    return NextResponse.json({ status: "completed", ...summary }, { status: 200 });
  } catch (error) {
    // Only a genuinely unexpected top-level failure lands here (e.g. can't
    // reach the DB at all) — per-item failures are caught inside
    // runJobDiscovery and reported in `errors` alongside a 200.
    console.error("discover-jobs: unexpected top-level failure", error);
    return NextResponse.json({ status: "failed", error: String(error) }, { status: 500 });
  } finally {
    await releaseDiscoveryLock(supabase, { completed });
  }
}
