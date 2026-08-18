import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { actorNameFromUser, logActivity } from "@/lib/api/activity";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { createClient, getCachedRolePermissions } from "@/lib/supabase/server";
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

  // Job pages are open to every role; the gate stays as a named helper so a
  // future restricted role only has to change lib/auth/roles.ts.
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) {
    return NextResponse.json({ status: "error", error: "Not authorized." }, { status: 403 });
  }

  // Discovery itself is platform-wide (the run resolves the org internally),
  // but the caller must still be acting from their own organization.
  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // The global cooldown lock already bounds successful runs to one per 15
  // minutes; this per-user cap just stops lock-acquisition churn (each attempt
  // touches cron_run_locks + revalidates routes) from being spammed.
  const userLimit = checkRateLimit(`discovery-run:user:${user.id}`, 6, 15 * 60_000);
  if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfterMs);

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

    // A user-triggered run, not the nightly cron (which uses no acting user
    // and so has nothing to attribute this to) — worth its own entry since
    // it's a deliberate action from the Discovery page, not scheduled.
    await logActivity({
      supabase,
      organizationId: org.organizationId,
      actorUserId: user.id,
      actorName: actorNameFromUser(user),
      action: "discovery_run_triggered",
      description: `Ran job discovery (${summary.jobsUpserted} new job(s), ${summary.matchesWritten} match(es) scored)`,
      metadata: {
        jobsUpserted: summary.jobsUpserted,
        matchesWritten: summary.matchesWritten,
        errors: summary.errors.length,
      },
      request,
    });

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
