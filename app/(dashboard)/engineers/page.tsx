import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import {
  EngineersList,
  type EngineerListItem,
} from "./engineers-list";

export default async function EngineersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const isAdmin = await getCachedIsAdmin();
  const { error } = await searchParams;

  const [
    { data: engineers },
    { data: engineerSkills },
    { data: assignmentRows },
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
        "engineer_id, profiles!engineer_bd_assignments_bd_user_id_fkey(full_name)",
      )
      .is("unassigned_at", null),
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

      <EngineersList engineers={list} isAdmin={Boolean(isAdmin)} />
    </>
  );
}