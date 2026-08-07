import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { updateEngineer } from "@/lib/actions/engineers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EngineerActiveToggle } from "./engineer-active-toggle";
import { EngineerAssignments } from "./engineer-assignments";
import { EngineerCvList } from "./engineer-cv-list";
import { EngineerCvUploadForm } from "./engineer-cv-upload-form";
import { EngineerCoreFieldsForm } from "../engineer-core-fields-form";

export default async function EngineerDetailPage({
  params,
}: {
  params: Promise<{ engineerId: string }>;
}) {
  const { engineerId } = await params;
  const supabase = await createClient();

  const isAdmin = await getCachedIsAdmin();

  // engineers_select RLS (is_admin() OR id IN assigned_engineer_ids()) means
  // a null result here covers both "doesn't exist" and "exists but isn't
  // visible to you" — same deliberate non-distinction as earlier chunks.
  const { data: engineer } = await supabase
    .from("engineers")
    .select(
      "id, full_name, email, phone, location, seniority_level_id, years_experience, rate_expectation, rate_currency, summary, is_active",
    )
    .eq("id", engineerId)
    .maybeSingle();

  if (!engineer) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Engineer not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only Admin edits core details, so these extra reads (and the form
  // itself) never run for a BD viewer.
  let seniorityLevels: { id: string; name: string }[] = [];

  if (isAdmin) {
    const { data: levels } = await supabase
      .from("seniority_levels")
      .select("id, name")
      .eq("is_active", true)
      .order("rank");
    seniorityLevels = levels ?? [];
  }

  // engineer_bd_assignments_select RLS already scopes a BD viewer to only
  // the (necessarily active) assignment rows for engineers assigned to
  // them — same query for both roles, per doc 03's "everyone can view
  // relevant history."
  const { data: assignmentRows } = await supabase
    .from("engineer_bd_assignments")
    .select("bd_user_id, assigned_at, profiles!engineer_bd_assignments_bd_user_id_fkey(full_name, email)")
    .eq("engineer_id", engineerId)
    .is("unassigned_at", null)
    .order("assigned_at");

  const assignments = (assignmentRows ?? []).map((row) => ({
    bdUserId: row.bd_user_id,
    fullName: row.profiles?.full_name ?? "—",
    email: row.profiles?.email ?? "—",
  }));

  // BD picker candidates — Admin-only, so this never runs for a BD viewer.
  let bdCandidates: { id: string; fullName: string; email: string }[] = [];

  if (isAdmin) {
    const { data: bdProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_roles!user_roles_user_id_fkey(roles(name))")
      .order("full_name");

    const assignedIds = new Set(assignments.map((assignment) => assignment.bdUserId));

    bdCandidates = (bdProfiles ?? [])
      .filter((profile) =>
        (profile.user_roles ?? []).some((userRole) => userRole.roles?.name === "bd_executive"),
      )
      .filter((profile) => !assignedIds.has(profile.id))
      .map((profile) => ({ id: profile.id, fullName: profile.full_name, email: profile.email }));
  }

  // engineer_cvs_select RLS scopes this identically to engineers_select —
  // same query for both roles. Signed URLs are generated here (not in a
  // separate Server Action) because this Server Component already runs
  // with the viewer's own RLS-scoped session, and createSignedUrl() only
  // succeeds if that session's cv_files_select policy permits it — the
  // same access boundary already proven for every other read on this page.
  const { data: cvRows } = await supabase
    .from("engineer_cvs")
    .select("id, label, file_name, storage_path, is_current, created_at")
    .eq("engineer_id", engineerId)
    .order("created_at", { ascending: false });

  const cvs = await Promise.all(
    (cvRows ?? []).map(async (cv) => {
      const { data: signedUrlData } = await supabase.storage
        .from("cv-files")
        .createSignedUrl(cv.storage_path, 3600);
      return {
        id: cv.id,
        label: cv.label,
        fileName: cv.file_name,
        isCurrent: cv.is_current,
        createdAt: cv.created_at,
        downloadUrl: signedUrlData?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{engineer.full_name}</h1>
          <p className="text-sm text-muted-foreground">{engineer.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge variant={engineer.is_active ? "success" : "neutral"}>
            {engineer.is_active ? "Active" : "Inactive"}
          </StatusBadge>
          {isAdmin && (
            <EngineerActiveToggle engineerId={engineer.id} isActive={engineer.is_active} />
          )}
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Core details</CardTitle>
          </CardHeader>
          <CardContent>
            <EngineerCoreFieldsForm
              action={updateEngineer}
              engineerId={engineer.id}
              initialValues={{
                fullName: engineer.full_name,
                email: engineer.email,
                phone: engineer.phone ?? "",
                location: engineer.location ?? "",
                seniorityLevelId: engineer.seniority_level_id,
                yearsExperience: engineer.years_experience?.toString() ?? "",
                rateExpectation: engineer.rate_expectation?.toString() ?? "",
                rateCurrency: engineer.rate_currency,
                summary: engineer.summary ?? "",
              }}
              seniorityLevels={seniorityLevels}
              submitLabel="Save changes"
            />
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <EngineerAssignments
            engineerId={engineer.id}
            assignments={assignments}
            candidates={bdCandidates}
            isAdmin={Boolean(isAdmin)}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">CVs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EngineerCvList cvs={cvs} />
          {isAdmin && <EngineerCvUploadForm engineerId={engineer.id} />}
        </CardContent>
      </Card>
    </div>
  );
}
