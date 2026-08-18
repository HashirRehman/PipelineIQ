import { NextResponse } from "next/server";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * One application = one applied (job, profile) pair — a row in
 * job_profile_states with status 'applied'. A single job can therefore
 * produce several application rows (one per profile that applied), which is
 * what the statistics UI wants: "how many profiles have been used to apply"
 * counts rows, while "jobs applied" counts distinct jobs.
 */
export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  profileId: string;
  profileName: string;
  /** Owner of the profile used for the application — the BD attribution. */
  userId: string | null;
  appliedAt: string;
}

export interface ApplicationsResponse {
  applications: JobApplication[];
  /** Admin and BD Manager see every org application; a Business Developer's
   *  response is already scoped to their own profiles. */
  canViewAllData: boolean;
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = await getCachedRolePermissions();

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;
  const organizationId = org.organizationId;

  // Profiles in scope — the same gate the discovery feed uses: Admins and BD
  // Managers see every org profile's applications; Business Developers only
  // their own assigned profiles (RLS on job_profile_states agrees, but the
  // explicit .in() keeps the scope obvious and the query cheap).
  let profileQuery = supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (!perms.canAccessProfiles) {
    profileQuery = profileQuery.eq("user_id", user.id);
  }
  const { data: profileRows, error: profileError } = await profileQuery;
  if (profileError) {
    console.error("api/jobs/applications: profiles query failed", profileError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const visibleProfileIds = (profileRows ?? []).map((p) => p.id);
  if (visibleProfileIds.length === 0) {
    return NextResponse.json({
      applications: [],
      canViewAllData: perms.canAccessProfiles,
    });
  }

  const { data: rows, error } = await supabase
    .from("job_profile_states")
    .select(
      "id, created_at, jobs!inner(id, title, company_name), profiles!inner(id, full_name, user_id)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "applied")
    .is("deleted_at", null)
    .in("profile_id", visibleProfileIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("api/jobs/applications: states query failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const applications: JobApplication[] = (rows ?? []).map((row) => ({
    id: row.id,
    jobId: row.jobs.id,
    jobTitle: row.jobs.title,
    company: row.jobs.company_name ?? "",
    profileId: row.profiles.id,
    profileName: row.profiles.full_name,
    userId: row.profiles.user_id ?? null,
    appliedAt: row.created_at,
  }));

  return NextResponse.json({
    applications,
    canViewAllData: perms.canAccessProfiles,
  });
}
