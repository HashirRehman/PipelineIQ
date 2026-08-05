import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { EngineerDetailSheet } from "@/components/engineers/engineer-detail-sheet";
import {
  EngineersList,
  type EngineerListItem,
} from "@/components/engineers/engineers-list";

export default async function EngineersPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    engineerId?: string;
  }>;
}) {
  const supabase = await createClient();
  const isAdmin = Boolean(await getCachedIsAdmin());
  const { error, engineerId } = await searchParams;

  const [
    { data: engineers },
    { data: engineerSkills },
    { data: assignmentRows },
    { data: seniorityLevels },
  ] = await Promise.all([
    supabase
      .from("engineers")
      .select(
        "id, full_name, email, location, is_active, rate_expectation, rate_currency, seniority_levels(name)",
      )
      .order("full_name"),

    supabase
      .from("engineer_skills")
      .select("engineer_id, skills(name)"),

    supabase
      .from("engineer_bd_assignments")
      .select(
        "engineer_id, bd_user_id, profiles!engineer_bd_assignments_bd_user_id_fkey(full_name, email)",
      )
      .is("unassigned_at", null),

    supabase
      .from("seniority_levels")
      .select("id, name")
      .eq("is_active", true)
      .order("rank"),
  ]);

  const skillsByEngineer = new Map<string, string[]>();

  for (const row of engineerSkills ?? []) {
    const skillName = row.skills?.name;

    if (!skillName) {
      continue;
    }

    const existingSkills = skillsByEngineer.get(row.engineer_id) ?? [];
    existingSkills.push(skillName);
    skillsByEngineer.set(row.engineer_id, existingSkills);
  }

  const assignedBdsByEngineer = new Map<string, string[]>();

  for (const row of assignmentRows ?? []) {
    const fullName = row.profiles?.full_name;

    if (!fullName) {
      continue;
    }

    const existingNames =
      assignedBdsByEngineer.get(row.engineer_id) ?? [];

    existingNames.push(fullName.split(" ")[0] ?? fullName);
    assignedBdsByEngineer.set(row.engineer_id, existingNames);
  }

  const list: EngineerListItem[] = (engineers ?? []).map((engineer) => ({
    id: engineer.id,
    fullName: engineer.full_name,
    email: engineer.email,
    location: engineer.location,
    isActive: engineer.is_active,
    seniority: engineer.seniority_levels?.name ?? null,
    rateExpectation: engineer.rate_expectation,
    rateCurrency: engineer.rate_currency,
    skills: skillsByEngineer.get(engineer.id) ?? [],
    assignedBdNames: assignedBdsByEngineer.get(engineer.id) ?? [],
  }));

  let detailSheet: React.ReactNode = null;

  if (engineerId) {
    const { data: selectedEngineer } = await supabase
      .from("engineers")
      .select(
        "id, full_name, email, phone, location, seniority_level_id, years_experience, rate_expectation, rate_currency, summary, is_active, seniority_levels(name)",
      )
      .eq("id", engineerId)
      .maybeSingle();

    if (selectedEngineer) {
      const { data: cvRows } = await supabase
        .from("engineer_cvs")
        .select(
          "id, label, file_name, storage_path, is_current, created_at",
        )
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

      const assignments = (assignmentRows ?? [])
        .filter((row) => row.engineer_id === engineerId)
        .map((row) => ({
          bdUserId: row.bd_user_id,
          fullName: row.profiles?.full_name ?? "Unknown user",
          email: row.profiles?.email ?? "",
        }));

      let bdCandidates: {
        id: string;
        fullName: string;
        email: string;
      }[] = [];

      if (isAdmin) {
        const { data: bdProfiles } = await supabase
          .from("profiles")
          .select(
            "id, full_name, email, user_roles!user_roles_user_id_fkey(roles(name))",
          )
          .order("full_name");

        const assignedIds = new Set(
          assignments.map((assignment) => assignment.bdUserId),
        );

        bdCandidates = (bdProfiles ?? [])
          .filter((profile) =>
            (profile.user_roles ?? []).some(
              (userRole) =>
                userRole.roles?.name === "bd_executive",
            ),
          )
          .filter((profile) => !assignedIds.has(profile.id))
          .map((profile) => ({
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email,
          }));
      }

      detailSheet = (
        <EngineerDetailSheet
          engineer={{
            id: selectedEngineer.id,
            fullName: selectedEngineer.full_name,
            email: selectedEngineer.email,
            phone: selectedEngineer.phone,
            location: selectedEngineer.location,
            seniority:
              selectedEngineer.seniority_levels?.name ?? null,
            seniorityLevelId:
              selectedEngineer.seniority_level_id,
            yearsExperience:
              selectedEngineer.years_experience,
            rateExpectation:
              selectedEngineer.rate_expectation,
            rateCurrency:
              selectedEngineer.rate_currency,
            summary: selectedEngineer.summary,
            isActive: selectedEngineer.is_active,
            skillNames: (
              skillsByEngineer.get(selectedEngineer.id) ?? []
            ).join(", "),
          }}
          seniorityLevels={seniorityLevels ?? []}
          assignments={assignments}
          bdCandidates={bdCandidates}
          cvs={cvs}
          isAdmin={isAdmin}
        />
      );
    }
  }

  return (
    <>
      {error === "not_authorized" && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            You don&apos;t have access to that page.
          </p>
        </div>
      )}

      <EngineersList
        engineers={list}
        isAdmin={isAdmin}
        seniorityLevels={seniorityLevels ?? []}
      />

      {detailSheet}
    </>
  );
}