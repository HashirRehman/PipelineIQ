import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  engineerMutationResponse,
  readJsonBody,
} from "@/lib/api/engineers-response";
import { isSameOrigin } from "@/lib/api/guard";
import { createEngineer } from "@/lib/services/engineers";
import {
  createClient,
  getCachedIsAdmin,
  getCachedUser,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type EngineerListApiItem = {
  id: string;
  fullName: string;
  email: string;
  location: string | null;
  isActive: boolean;
  seniority: string | null;
  rateExpectation: number | null;
  rateCurrency: string;
  skills: string[];
  assignedBdNames: string[];
};

export type EngineersListApiResponse = {
  engineers: EngineerListApiItem[];
  seniorityLevels: {
    id: string;
    name: string;
  }[];
  isAdmin: boolean;
};

export async function GET() {
  const user = await getCachedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = await createClient();

  const [
    isAdmin,
    engineersResult,
    engineerSkillsResult,
    assignmentsResult,
    seniorityLevelsResult,
  ] = await Promise.all([
    getCachedIsAdmin(),

    supabase
      .from("engineers")
      .select(
        `
          id,
          full_name,
          email,
          location,
          is_active,
          rate_expectation,
          rate_currency,
          seniority_levels(name)
        `,
      )
      .order("full_name"),

    supabase
      .from("engineer_skills")
      .select("engineer_id, skills(name)"),

    supabase
      .from("engineer_bd_assignments")
      .select(
        `
          engineer_id,
          bd_user_id,
          profiles!engineer_bd_assignments_bd_user_id_fkey(
            full_name,
            email
          )
        `,
      )
      .is("unassigned_at", null),

    supabase
      .from("seniority_levels")
      .select("id, name")
      .eq("is_active", true)
      .order("rank"),
  ]);

  const queryError =
    engineersResult.error ??
    engineerSkillsResult.error ??
    assignmentsResult.error ??
    seniorityLevelsResult.error;

  if (queryError) {
    console.error("api/engineers: query failed", queryError);

    return NextResponse.json(
      { error: "Failed to load engineer profiles." },
      { status: 500 },
    );
  }

  const skillsByEngineer = new Map<string, string[]>();

  for (const row of engineerSkillsResult.data ?? []) {
    const skillName = row.skills?.name;

    if (!skillName) {
      continue;
    }

    const currentSkills =
      skillsByEngineer.get(row.engineer_id) ?? [];

    currentSkills.push(skillName);
    skillsByEngineer.set(row.engineer_id, currentSkills);
  }

  const assignedBdsByEngineer = new Map<string, string[]>();

  for (const row of assignmentsResult.data ?? []) {
    const fullName = row.profiles?.full_name;

    if (!fullName) {
      continue;
    }

    const currentNames =
      assignedBdsByEngineer.get(row.engineer_id) ?? [];

    currentNames.push(fullName.split(" ")[0] ?? fullName);

    assignedBdsByEngineer.set(
      row.engineer_id,
      currentNames,
    );
  }

  const engineers: EngineerListApiItem[] = (
    engineersResult.data ?? []
  ).map((engineer) => ({
    id: engineer.id,
    fullName: engineer.full_name,
    email: engineer.email,
    location: engineer.location,
    isActive: engineer.is_active,
    seniority: engineer.seniority_levels?.name ?? null,
    rateExpectation: engineer.rate_expectation,
    rateCurrency: engineer.rate_currency,
    skills: skillsByEngineer.get(engineer.id) ?? [],
    assignedBdNames:
      assignedBdsByEngineer.get(engineer.id) ?? [],
  }));

  const response: EngineersListApiResponse = {
    engineers,
    seniorityLevels: seniorityLevelsResult.data ?? [],
    isAdmin: Boolean(isAdmin),
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { body, response: badBody } = await readJsonBody(request);
  if (badBody) {
    return badBody;
  }

  const supabase = await createClient();
  const result = await createEngineer(supabase, body);

  if (result.success) {
    revalidatePath("/engineers");
  }

  return engineerMutationResponse(result);
}