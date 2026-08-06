import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EngineerActiveToggle } from "@/components/engineers/engineer-active-toggle";
import { EngineerAssignments } from "@/components/engineers/engineer-assignments";
import { EngineerCvList } from "@/components/engineers/engineer-cv-list";
import { EngineerCvUploadForm } from "@/components/engineers/engineer-cv-upload-form";
import { EngineerCoreFieldsForm } from "@/components/engineers/engineer-core-fields-form";

export default async function EngineerDetailPage({
  params,
}: {
  params: Promise<{ engineerId: string }>;
}) {
  const { engineerId } = await params;
  const supabase = await createClient();

  const isAdmin = await getCachedIsAdmin();

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

  let seniorityLevels: { id: string; name: string }[] = [];

  if (isAdmin) {
    const { data: levels } = await supabase
      .from("seniority_levels")
      .select("id, name")
      .eq("is_active", true)
      .order("rank");
    seniorityLevels = levels ?? [];
  }

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
              mode="update"
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
