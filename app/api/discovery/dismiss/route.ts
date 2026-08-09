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

  const { jobId, profileId } = parsed.data;

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // State rows are lazy: a (job, profile) row is created here, on first
  // action — absence of a row means 'suggested'. The profile must belong to
  // the caller's org (scope the lookup so a cross-org profile id fails here),
  // and the job must belong to the same org — the state row carries that org.
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", profileId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  // A job already in the leads pipeline can't be dismissed — the lead pins
  // this state row (job_profile_state_id), so flipping it to dismissed would
  // orphan the lead. The UI hides the Dismiss action for lead jobs; this is
  // the authoritative guard for direct API calls.
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("job_id", jobId)
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingLead) {
    return NextResponse.json(
      { error: "This job is already in Leads and cannot be dismissed." },
      { status: 400 },
    );
  }

  const { error: insertError } = await supabase.from("job_profile_states").insert({
    organization_id: profile.organization_id,
    job_id: jobId,
    profile_id: profileId,
    status: "dismissed",
    dismissed_reason: parsed.data.reason,
    user_id: user.id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // A live row already exists for the pair (e.g. previously applied) —
      // flip it instead of failing on the one-live-row-per-pair index.
      const { error: updateError } = await supabase
        .from("job_profile_states")
        .update({ status: "dismissed", dismissed_reason: parsed.data.reason, user_id: user.id })
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

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
