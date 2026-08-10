import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { dismissJobSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = dismissJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { jobId, profileIds, reason } = parsed.data;
  const uniqueProfileIds = Array.from(new Set(profileIds));

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // State rows are lazy: a (job, profile) row is created here, on first
  // action — absence of a row means 'suggested'. Every requested profile
  // must belong to the caller's org (scope the lookup so a cross-org
  // profile id fails here), and the job must belong to the same org — the
  // state row carries that org.
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .in("id", uniqueProfileIds)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (profileError) {
    console.error("api/discovery/dismiss: profiles query failed", profileError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!profileRows || profileRows.length !== uniqueProfileIds.length) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  // A job already in the leads pipeline can't be dismissed — the lead pins
  // its state row (job_profile_state_id), so flipping it to dismissed would
  // orphan the lead. The UI never sends lead pairs here; this is the
  // authoritative guard for direct API calls.
  const { data: leadRows, error: leadError } = await supabase
    .from("leads")
    .select("profile_id")
    .eq("job_id", jobId)
    .in("profile_id", uniqueProfileIds)
    .is("deleted_at", null);

  if (leadError) {
    console.error("api/discovery/dismiss: leads query failed", leadError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (leadRows && leadRows.length > 0) {
    return NextResponse.json(
      { error: "This job is already in Leads and cannot be dismissed." },
      { status: 400 },
    );
  }

  for (const profileId of uniqueProfileIds) {
    const { error: insertError } = await supabase.from("job_profile_states").insert({
      organization_id: org.organizationId,
      job_id: jobId,
      profile_id: profileId,
      status: "dismissed",
      dismissed_reason: reason,
      user_id: user.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        // A live row already exists for the pair (e.g. previously applied) —
        // flip it instead of failing on the one-live-row-per-pair index.
        const { error: updateError } = await supabase
          .from("job_profile_states")
          .update({ status: "dismissed", dismissed_reason: reason, user_id: user.id })
          .eq("job_id", jobId)
          .eq("profile_id", profileId)
          .is("deleted_at", null);

        if (updateError) {
          console.error("api/discovery/dismiss: state update failed", updateError);
          return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 500 },
          );
        }
      } else {
        console.error("api/discovery/dismiss: state insert failed", insertError);
        return NextResponse.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 },
        );
      }
    }
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
