// Module 2 — engineer-record Server Actions (Admin-only core-details CRUD)
"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createEngineerSchema,
  engineerBdAssignmentSchema,
  setEngineerActiveSchema,
  updateEngineerSchema,
  uploadEngineerCvSchema,
} from "@/lib/validation/schemas";

export type EngineerActionState = {
  error?: string;
  success?: boolean;
  engineerId?: string;
};

// engineers_insert/engineers_update RLS policies already enforce is_admin()
// regardless — this check exists so a non-admin gets a clean "Not
// authorized." instead of a raw Postgres RLS-violation error string, the
// same UX bar Module 1 holds elsewhere. It is not a second security
// boundary the way the equivalent check in inviteUser is (that one uses the
// service-role client, which actually bypasses RLS).
export async function requireAdmin(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authorized." } as const;
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { error: "Not authorized." } as const;
  }

  return { user };
}

// Splits/trims/drops-empties, then dedupes case-insensitively (keeping the
// first-seen casing) — "React, react" submitted together should resolve to
// one skill, not two, same guarantee the DB's own
// skills_name_unique_ci index provides across separate submissions.
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

// Resolves each submitted skill name to a skills.id, creating rows for
// names that don't exist yet and reactivating any that exist but are
// currently soft-disabled (is_active = false) — typing a retired skill's
// name is an explicit request to use it again, not a request to duplicate
// it (which the DB's case-insensitive unique index would reject anyway).
// Fetches the whole skills table rather than filtering server-side:
// PostgREST has no case-insensitive multi-value IN, and this table is a
// small curated vocabulary, not a high-cardinality one.
async function resolveSkillIds(
  supabase: SupabaseClient,
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
      // 23505 here means someone else created one of these exact names
      // between the fetch above and this insert — rare, but a clean retry
      // (which will now find it via the fetch) is safer than partially
      // resolving and silently dropping a skill.
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

// engineerCoreFieldsSchema (lib/validation/schemas.ts) is camelCase to match
// form field naming; the engineers table columns are snake_case. This was
// previously spread straight into .insert()/.update() with no conversion —
// silently wrong at runtime — and only surfaced once real generated types
// (not `any`) made the column-name mismatch a compile error.
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
  supabase: SupabaseClient,
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
  _prevState: EngineerActionState,
  formData: FormData,
): Promise<EngineerActionState> {
  const parsed = createEngineerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    seniorityLevelId: formData.get("seniorityLevelId"),
    yearsExperience: formData.get("yearsExperience"),
    rateExpectation: formData.get("rateExpectation"),
    rateCurrency: formData.get("rateCurrency"),
    summary: formData.get("summary"),
    skillNames: formData.get("skillNames"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  const { skillNames, ...engineerFields } = parsed.data;

  const { data, error } = await supabase
    .from("engineers")
    .insert({ ...toEngineerRow(engineerFields), created_by: adminCheck.user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "An engineer with this email already exists." };
    }
    console.error("createEngineer: engineers insert failed", error);
    return { error: "Something went wrong. Please try again." };
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

  revalidatePath("/engineers");
  return { success: true, engineerId: data.id };
}

export async function updateEngineer(
  _prevState: EngineerActionState,
  formData: FormData,
): Promise<EngineerActionState> {
  const parsed = updateEngineerSchema.safeParse({
    engineerId: formData.get("engineerId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    seniorityLevelId: formData.get("seniorityLevelId"),
    yearsExperience: formData.get("yearsExperience"),
    rateExpectation: formData.get("rateExpectation"),
    rateCurrency: formData.get("rateCurrency"),
    summary: formData.get("summary"),
    skillNames: formData.get("skillNames"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  const { engineerId, skillNames, ...engineerFields } = parsed.data;

  const { error } = await supabase
    .from("engineers")
    .update(toEngineerRow(engineerFields))
    .eq("id", engineerId);

  if (error) {
    if (error.code === "23505") {
      return { error: "An engineer with this email already exists." };
    }
    console.error("updateEngineer: engineers update failed", error);
    return { error: "Something went wrong. Please try again." };
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

  revalidatePath("/engineers");
  revalidatePath(`/engineers/${engineerId}`);
  return { success: true, engineerId };
}

export async function setEngineerActive(
  _prevState: EngineerActionState,
  formData: FormData,
): Promise<EngineerActionState> {
  const parsed = setEngineerActiveSchema.safeParse({
    engineerId: formData.get("engineerId"),
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  const { engineerId, isActive } = parsed.data;

  const { error } = await supabase
    .from("engineers")
    .update({ is_active: isActive })
    .eq("id", engineerId);

  if (error) {
    console.error("setEngineerActive: engineers update failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/engineers");
  revalidatePath(`/engineers/${engineerId}`);
  return { success: true, engineerId };
}

// reassign_engineer_bd() closes an old assignment row and/or opens a new one
// in one function call — see supabase/migrations/20260717130000_*.sql. Both
// actions below call it with one of the two BD-id params left null, so the
// close-then-open pair used by a future "reassign" UI action shares the same
// atomic path instead of being reinvented separately.
async function callReassignEngineerBd(
  supabase: SupabaseClient,
  args: { engineerId: string; oldBdUserId: string | null; newBdUserId: string | null },
): Promise<EngineerActionState> {
  const { error } = await supabase.rpc("reassign_engineer_bd", {
    p_engineer_id: args.engineerId,
    p_old_bd_user_id: args.oldBdUserId,
    p_new_bd_user_id: args.newBdUserId,
  });

  if (error) {
    // P0001 is plpgsql's default RAISE EXCEPTION code — these are the
    // function's own curated, already user-safe messages.
    if (error.code === "P0001") {
      return { error: error.message };
    }
    console.error("reassign_engineer_bd rpc failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/engineers");
  revalidatePath(`/engineers/${args.engineerId}`);
  return { success: true, engineerId: args.engineerId };
}

export async function assignEngineerToBd(
  _prevState: EngineerActionState,
  formData: FormData,
): Promise<EngineerActionState> {
  const parsed = engineerBdAssignmentSchema.safeParse({
    engineerId: formData.get("engineerId"),
    bdUserId: formData.get("bdUserId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  return callReassignEngineerBd(supabase, {
    engineerId: parsed.data.engineerId,
    oldBdUserId: null,
    newBdUserId: parsed.data.bdUserId,
  });
}

export async function unassignEngineerFromBd(
  _prevState: EngineerActionState,
  formData: FormData,
): Promise<EngineerActionState> {
  const parsed = engineerBdAssignmentSchema.safeParse({
    engineerId: formData.get("engineerId"),
    bdUserId: formData.get("bdUserId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  return callReassignEngineerBd(supabase, {
    engineerId: parsed.data.engineerId,
    oldBdUserId: parsed.data.bdUserId,
    newBdUserId: null,
  });
}

// Mirrors engineer_cvs' own hard CHECK constraints (see the Module 2
// migration) — a safety net so an app_settings misconfiguration looser than
// the DB's hard limits can never pass this check and then fail the DB
// insert *after* the file has already been uploaded to Storage.
const CV_HARD_MAX_BYTES = 10_485_760;
const CV_HARD_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function uploadEngineerCv(
  _prevState: EngineerActionState,
  formData: FormData,
): Promise<EngineerActionState> {
  const parsed = uploadEngineerCvSchema.safeParse({
    engineerId: formData.get("engineerId"),
    label: formData.get("label"),
    file: formData.get("file"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { engineerId, label, file } = parsed.data;

  const supabase = await createClient();

  // Admin-only is a deliberate reversal, not the original design: CV upload
  // was initially built as Admin + assigned-BD (by analogy to doc 01 §11's
  // lead-files "uploads mirror SELECT" example), then reverted after
  // deciding engineer-profile/CV curation is an Admin task and CVs need a
  // single point of quality control. Do not "fix" this back to
  // Admin+assigned-BD without revisiting that decision explicitly — see
  // migration 20260717140000 and project memory module2_cv_upload_cleanup_bug.md.
  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
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
    return { error: "Something went wrong. Please try again." };
  }

  // Fail closed: the effective limit can never be looser than the DB's own
  // hard CHECK constraints, no matter what app_settings currently holds.
  // app_settings.value is jsonb (typed as Json — string | number | boolean |
  // null | Json[] | {[key: string]: Json}), so each array element needs an
  // explicit string narrowing before it can be compared to the hard allowlist.
  const effectiveMaxBytes = Math.min(maxBytesSetting, CV_HARD_MAX_BYTES);
  const effectiveAllowedMimeTypes = allowedMimeTypesSetting
    .filter((type): type is string => typeof type === "string")
    .filter((type) => CV_HARD_ALLOWED_MIME_TYPES.includes(type));

  if (file.size > effectiveMaxBytes) {
    return {
      error: `File exceeds the maximum size of ${Math.round(effectiveMaxBytes / 1024 / 1024)}MB.`,
    };
  }

  if (!effectiveAllowedMimeTypes.includes(file.type)) {
    return { error: "File type not allowed. Upload a PDF, DOC, or DOCX." };
  }

  // The storage path convention ({engineer_id}/{cv_id}-{filename}) needs the
  // CV's id before the row exists, so it's generated here rather than left
  // to the table's DEFAULT gen_random_uuid(). The filename is sanitized so a
  // crafted name can never corrupt the {engineer_id} path segment that the
  // cv-files storage RLS policy parses via storage.foldername().
  const cvId = crypto.randomUUID();
  const safeFileName = file.name.replace(/[/\\]/g, "_");
  const storagePath = `${engineerId}/${cvId}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("cv-files")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("uploadEngineerCv: storage upload failed", uploadError);
    return { error: "Something went wrong uploading the file. Please try again." };
  }

  const { error: insertError } = await supabase.from("engineer_cvs").insert({
    id: cvId,
    engineer_id: engineerId,
    label,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    uploaded_by: adminCheck.user.id,
  });

  if (insertError) {
    console.error("uploadEngineerCv: engineer_cvs insert failed", insertError);

    // Compensating action, not a transaction (Storage and Postgres aren't
    // one) — best-effort cleanup so a failed insert doesn't leave an
    // orphaned file with no database record pointing to it.
    //
    // Deliberately uses the admin (service-role) client here, not the
    // RLS-scoped one: cv-files has no DELETE storage policy at all (by
    // design — CVs are append-only/never-overwritten, see the Module 2
    // migration), so a normal user's client silently deletes zero rows and
    // reports success without actually removing anything. This one call
    // escalates privilege specifically to correct a partial-failure system
    // state, the same narrow justification lib/supabase/admin.ts already
    // documents for inviteUser's use of the admin client — it is not a
    // general "users can delete their own CVs" capability.
    const { error: cleanupError, data: cleanupData } = await createAdminClient()
      .storage.from("cv-files")
      .remove([storagePath]);
    if (cleanupError || !cleanupData || cleanupData.length === 0) {
      console.error(
        "uploadEngineerCv: cleanup of orphaned storage object failed",
        cleanupError ?? "remove() reported no files removed",
      );
    }

    return { error: "Something went wrong saving the CV record. Please try again." };
  }

  revalidatePath("/engineers");
  revalidatePath(`/engineers/${engineerId}`);
  return { success: true, engineerId };
}
