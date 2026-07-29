import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroqAiClient } from "@/lib/ai/groq-client";
import { acquireDiscoveryLock, releaseDiscoveryLock, runJobDiscovery } from "@/lib/cron/discover-jobs";

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
    console.error("discover-jobs: unexpected top-level failure", error);
    return NextResponse.json({ status: "failed", error: String(error) }, { status: 500 });
  } finally {
    await releaseDiscoveryLock(supabase, { completed });
  }
}
