import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroqAiClient } from "@/lib/ai/groq-client";
import {
  acquireDiscoveryLock,
  releaseDiscoveryLock,
  runJobDiscovery,
  type DiscoverySummary,
} from "@/lib/cron/discover-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Not authorized." }, { status: 401 });
  }

  // Discovery itself is platform-wide (the run resolves the org internally),
  // but the caller must still be acting from their own organization.
  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const adminClient = createAdminClient();

  const lockResult = await acquireDiscoveryLock(adminClient);
  if (!lockResult.acquired) {
    if (lockResult.reason === "cooldown") {
      return NextResponse.json({
        status: "cooldown",
        nextRunAvailableAt: lockResult.nextRunAvailableAt,
      });
    }
    return NextResponse.json({ status: "skipped" });
  }

  let completed = false;
  try {
    const summary: DiscoverySummary = await runJobDiscovery(adminClient, new GroqAiClient());
    completed = true;
    revalidatePath("/");
    return NextResponse.json({ status: "completed", summary });
  } catch (error) {
    console.error("api/discovery/run: runJobDiscovery failed", error);
    return NextResponse.json(
      { status: "error", error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  } finally {
    await releaseDiscoveryLock(adminClient, { completed });
  }
}
