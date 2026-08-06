import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  createEngineerSchema,
  engineerBdAssignmentSchema,
  setEngineerActiveSchema,
  updateEngineerSchema,
  uploadEngineerCvSchema,
} from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;

export type EngineerMutationStatus = 400 | 401 | 403 | 404 | 409 | 500;

export type EngineerMutationResult =
  | {
      success: true;
      engineerId: string;
      error?: string;
    }
  | {
      success: false;
      status: EngineerMutationStatus;
      error: string;
    };

function invalidInput(message: string | undefined): EngineerMutationResult {
  return { success: false, status: 400, error: message ?? "Invalid input." };
}

const NOT_AUTHORIZED = "Not authorized.";
type AdminGate =
  | { user: User; denied?: undefined }
  | { user?: undefined; denied: EngineerMutationResult };

async function requireAdminUser(supabase: Client): Promise<AdminGate> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { denied: { success: false, status: 401, error: NOT_AUTHORIZED } };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { denied: { success: false, status: 403, error: NOT_AUTHORIZED } };
  }

  return { user };
}

export async function requireAdmin(supabase: Client) {
  const gate = await requireAdminUser(supabase);

  if (gate.denied) {
    return { error: gate.denied.error } as const;
  }

  return { user: gate.user };
}

function parseSkillNames(raw: string): string[] {
  const seen = new Map<string, string>();
  for (const name of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, name);
    }
  }
  return [...seen.values()];
}

async function resolveSkillIds(
  supabase: Client,
  names: string[],
): Promise<{ skillIds: string[]; error?: string }> {
  if (names.length === 0) {
    return { skillIds: [] };
  }

  const { data: allSkills, error: fetchError } = await supabase
    .from("skills")
    .select("id, name, is_active");

  if (fetchError) {
    console.error("resolveSkillIds: skills fetch failed", fetchError);
    return { skillIds: [], error: "Something went wrong. Please try again." };
  }

  const byLowerName = new Map((allSkills ?? []).map((skill) => [skill.name.toLowerCase(), skill]));

  const resolvedIds: string[] = [];
  const idsNeedingReactivation: string[] = [];
  const namesToCreate: string[] = [];

  for (const name of names) {
    const match = byLowerName.get(name.toLowerCase());
    if (match) {
      resolvedIds.push(match.id);
      if (!match.is_active) {
        idsNeedingReactivation.push(match.id);
      }
    } else {
      namesToCreate.push(name);
    }
  }

  if (namesToCreate.length > 0) {
    const { data: created, error: insertError } = await supabase
      .from("skills")
      .insert(namesToCreate.map((name) => ({ name })))
      .select("id");

    if (insertError) {
      console.error("resolveSkillIds: skills insert failed", insertError);
      return {
        skillIds: [],
        error:
          insertError.code === "23505"
            ? "One of these skills was just added elsewhere — please try again."
            : "Something went wrong. Please try again.",
      };
    }

    resolvedIds.push(...(created ?? []).map((skill) => skill.id));
  }

  if (idsNeedingReactivation.length > 0) {
    const { error: reactivateError } = await supabase
      .from("skills")
      .update({ is_active: true })
      .in("id", idsNeedingReactivation);

    if (reactivateError) {
      console.error("resolveSkillIds: skills reactivate failed", reactivateError);
      return { skillIds: [], error: "Something went wrong. Please try again." };
    }
  }

  return { skillIds: resolvedIds };
}

function toEngineerRow(fields: {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  seniorityLevelId: string;
  yearsExperience?: number;
  rateExpectation?: number;
  rateCurrency: string;
  summary?: string;
}) {
  return {
    full_name: fields.fullName,
    email: fields.email,
    phone: fields.phone ?? null,
    location: fields.location ?? null,
    seniority_level_id: fields.seniorityLevelId,
    years_experience: fields.yearsExperience ?? null,
    rate_expectation: fields.rateExpectation ?? null,
    rate_currency: fields.rateCurrency,
    summary: fields.summary ?? null,
  };
}

async function syncEngineerSkills(
  supabase: Client,
  engineerId: string,
  skillIds: string[],
) {
  const uniqueSkillIds = [...new Set(skillIds)];

  const { error: deleteError } = await supabase
    .from("engineer_skills")
    .delete()
    .eq("engineer_id", engineerId);

  if (deleteError) {
    return deleteError;
  }

  if (uniqueSkillIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("engineer_skills").insert(
    uniqueSkillIds.map((skillId) => ({
      engineer_id: engineerId,
      skill_id: skillId,
    })),
  );

  return insertError;
}

export async function createEngineer(
  supabase: Client,
  input: unknown,
): Promise<EngineerMutationResult> {
  const parsed = createEngineerSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser(supabase);
  if (gate.denied) {
    return gate.denied;
  }

  const { skillNames, ...engineerFields } = parsed.data;

  const { data, error } = await supabase
    .from("engineers")
    .insert({ ...toEngineerRow(engineerFields), created_by: gate.user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        status: 409,
        error: "An engineer with this email already exists.",
      };
    }
    console.error("createEngineer: engineers insert failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  const { skillIds, error: resolveError } = await resolveSkillIds(supabase, parseSkillNames(skillNames));
  if (resolveError) {
    return { success: true, engineerId: data.id, error: resolveError };
  }

  const skillsError = await syncEngineerSkills(supabase, data.id, skillIds);
  if (skillsError) {
    console.error("createEngineer: engineer_skills insert failed", skillsError);
    return {
      success: true,
      engineerId: data.id,
      error: "Engineer created, but skills failed to save — edit the engineer to try again.",
    };
  }

  return { success: true, engineerId: data.id };
}

export async function updateEngineer(
  supabase: Client,
  engineerId: string,
  input: unknown,
): Promise<EngineerMutationResult> {
  const parsed = updateEngineerSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    engineerId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser(supabase);
  if (gate.denied) {
    return gate.denied;
  }

  const { skillNames, ...engineerFields } = parsed.data;
  const { data, error } = await supabase
    .from("engineers")
    .update(toEngineerRow(engineerFields))
    .eq("id", engineerId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        status: 409,
        error: "An engineer with this email already exists.",
      };
    }
    console.error("updateEngineer: engineers update failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (data.length === 0) {
    return { success: false, status: 404, error: "Engineer profile not found." };
  }

  const { skillIds, error: resolveError } = await resolveSkillIds(supabase, parseSkillNames(skillNames));
  if (resolveError) {
    return { success: true, engineerId, error: resolveError };
  }

  const skillsError = await syncEngineerSkills(supabase, engineerId, skillIds);
  if (skillsError) {
    console.error("updateEngineer: engineer_skills sync failed", skillsError);
    return {
      success: true,
      engineerId,
      error: "Engineer updated, but skills failed to save — try again.",
    };
  }

  return { success: true, engineerId };
}

export async function setEngineerActive(
  supabase: Client,
  engineerId: string,
  input: unknown,
): Promise<EngineerMutationResult> {
  const parsed = setEngineerActiveSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    engineerId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser(supabase);
  if (gate.denied) {
    return gate.denied;
  }

  const { isActive } = parsed.data;

  const { data, error } = await supabase
    .from("engineers")
    .update({ is_active: isActive })
    .eq("id", engineerId)
    .select("id");

  if (error) {
    console.error("setEngineerActive: engineers update failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (data.length === 0) {
    return { success: false, status: 404, error: "Engineer profile not found." };
  }

  return { success: true, engineerId };
}

async function callReassignEngineerBd(
  supabase: Client,
  args: { engineerId: string; oldBdUserId: string | null; newBdUserId: string | null },
): Promise<EngineerMutationResult> {
  const { error } = await supabase.rpc("reassign_engineer_bd", {
    p_engineer_id: args.engineerId,
    p_old_bd_user_id: args.oldBdUserId as unknown as string,
    p_new_bd_user_id: args.newBdUserId as unknown as string,
  });

  if (error) {
    if (error.code === "P0001") {
      return { success: false, status: 409, error: error.message };
    }
    console.error("reassign_engineer_bd rpc failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  return { success: true, engineerId: args.engineerId };
}

export async function assignEngineerToBd(
  supabase: Client,
  engineerId: string,
  input: unknown,
): Promise<EngineerMutationResult> {
  const parsed = engineerBdAssignmentSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    engineerId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser(supabase);
  if (gate.denied) {
    return gate.denied;
  }

  return callReassignEngineerBd(supabase, {
    engineerId: parsed.data.engineerId,
    oldBdUserId: null,
    newBdUserId: parsed.data.bdUserId,
  });
}

export async function unassignEngineerFromBd(
  supabase: Client,
  engineerId: string,
  bdUserId: string,
): Promise<EngineerMutationResult> {
  const parsed = engineerBdAssignmentSchema.safeParse({ engineerId, bdUserId });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser(supabase);
  if (gate.denied) {
    return gate.denied;
  }

  return callReassignEngineerBd(supabase, {
    engineerId: parsed.data.engineerId,
    oldBdUserId: parsed.data.bdUserId,
    newBdUserId: null,
  });
}

const CV_HARD_MAX_BYTES = 10_485_760;
const CV_HARD_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function uploadEngineerCv(
  supabase: Client,
  engineerId: string,
  formData: FormData,
): Promise<EngineerMutationResult> {
  const parsed = uploadEngineerCvSchema.safeParse({
    engineerId,
    label: formData.get("label"),
    file: formData.get("file"),
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const { label, file } = parsed.data;
  const gate = await requireAdminUser(supabase);
  if (gate.denied) {
    return gate.denied;
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["cv_max_file_size_bytes", "cv_allowed_mime_types"]);

  const maxBytesSetting = settingsRows?.find((row) => row.key === "cv_max_file_size_bytes")?.value;
  const allowedMimeTypesSetting = settingsRows?.find(
    (row) => row.key === "cv_allowed_mime_types",
  )?.value;

  if (settingsError || typeof maxBytesSetting !== "number" || !Array.isArray(allowedMimeTypesSetting)) {
    console.error("uploadEngineerCv: app_settings fetch failed or malformed", settingsError);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  const effectiveMaxBytes = Math.min(maxBytesSetting, CV_HARD_MAX_BYTES);
  const effectiveAllowedMimeTypes = allowedMimeTypesSetting
    .filter((type): type is string => typeof type === "string")
    .filter((type) => CV_HARD_ALLOWED_MIME_TYPES.includes(type));

  if (file.size > effectiveMaxBytes) {
    return {
      success: false,
      status: 400,
      error: `File exceeds the maximum size of ${Math.round(effectiveMaxBytes / 1024 / 1024)}MB.`,
    };
  }

  if (!effectiveAllowedMimeTypes.includes(file.type)) {
    return {
      success: false,
      status: 400,
      error: "File type not allowed. Upload a PDF, DOC, or DOCX.",
    };
  }

  const cvId = crypto.randomUUID();
  const safeFileName = file.name.replace(/[/\\]/g, "_");
  const storagePath = `${engineerId}/${cvId}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("cv-files")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("uploadEngineerCv: storage upload failed", uploadError);
    return {
      success: false,
      status: 500,
      error: "Something went wrong uploading the file. Please try again.",
    };
  }

  const { error: insertError } = await supabase.from("engineer_cvs").insert({
    id: cvId,
    engineer_id: engineerId,
    label,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    uploaded_by: gate.user.id,
    is_current: true,
  });

  if (insertError) {
    console.error("uploadEngineerCv: engineer_cvs insert failed", insertError);
    const { error: cleanupError, data: cleanupData } = await createAdminClient()
      .storage.from("cv-files")
      .remove([storagePath]);
    if (cleanupError || !cleanupData || cleanupData.length === 0) {
      console.error(
        "uploadEngineerCv: cleanup of orphaned storage object failed",
        cleanupError ?? "remove() reported no files removed",
      );
    }

    return {
      success: false,
      status: 500,
      error: "Something went wrong saving the CV record. Please try again.",
    };
  }

  return { success: true, engineerId };
}
