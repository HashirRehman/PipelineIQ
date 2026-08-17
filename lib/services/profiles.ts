import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { actorNameFromUser, logActivity } from "@/lib/api/activity";
import { getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import {
  CloudinaryConfigError,
  deleteCvFile,
  uploadCvFile,
  type CvUploadResult,
} from "@/lib/cloudinary";
import { scheduleCvParse } from "@/lib/cv-parsing/schedule";
import {
  archiveProfileSchema,
  createProfileSchema,
  deleteProfileCvSchema,
  setProfileAssignmentSchema,
  updateProfileSchema,
  uploadProfileCvSchema,
  UPDATABLE_PROFILE_FIELDS,
  type UpdatableProfileField,
} from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;

export type ProfileMutationStatus = 400 | 401 | 403 | 404 | 409 | 500;

export type ProfileMutationResult =
  | {
      success: true;
      profileId: string;
      error?: string;
    }
  | {
      success: false;
      status: ProfileMutationStatus;
      error: string;
    };

function invalidInput(message: string | undefined): ProfileMutationResult {
  return { success: false, status: 400, error: message ?? "Invalid input." };
}

const NOT_AUTHORIZED = "Not authorized.";
type AdminGate =
  | { user: User; denied?: undefined }
  | { user?: undefined; denied: ProfileMutationResult };

// Mirrors the rest of the app: roles come from the JWT's user_role claim
// baked in by the custom_access_token_hook migration (getCachedRolePermissions
// reads it locally via cached JWKS — no live RPC round trip), same as
// app/api/users/route.ts. RLS still re-checks is_admin()/is_bd_manager() live
// at query time regardless. Profile management is Admin + BD Manager
// (Business Developers see no Profiles page at all).
async function requireProfileManagerUser(): Promise<AdminGate> {
  const user = await getCachedUser();

  if (!user) {
    return { denied: { success: false, status: 401, error: NOT_AUTHORIZED } };
  }

  const perms = await getCachedRolePermissions();
  if (!perms.canAccessProfiles) {
    return { denied: { success: false, status: 403, error: NOT_AUTHORIZED } };
  }

  return { user };
}

// The org id is verified up front by the route (verifyOrganizationAccess)
// against the acting user's own users row; these services scope every write
// by it so a cross-org id can never touch another org's rows.
function toProfileRow(fields: {
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
    years_of_experience: fields.yearsExperience ?? null,
    rate_expectation: fields.rateExpectation ?? null,
    rate_currency: fields.rateCurrency,
    summary: fields.summary ?? null,
  };
}

export async function createProfile(
  supabase: Client,
  organizationId: string,
  input: unknown,
): Promise<ProfileMutationResult> {
  const parsed = createProfileSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireProfileManagerUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({ ...toProfileRow(parsed.data), organization_id: organizationId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        status: 409,
        error: "A profile with this email already exists.",
      };
    }
    console.error("createProfile: profiles insert failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  await logActivity({
    supabase,
    organizationId,
    actorUserId: gate.user.id,
    actorName: actorNameFromUser(gate.user),
    action: "profile_created",
    description: `Created profile "${parsed.data.fullName}"`,
    entityType: "profile",
    entityId: data.id,
    entityLabel: parsed.data.fullName,
  });

  return { success: true, profileId: data.id };
}

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const PROFILE_COLUMN_BY_FIELD: Record<UpdatableProfileField, keyof ProfileUpdate> = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
  location: "location",
  seniorityLevelId: "seniority_level_id",
  yearsExperience: "years_of_experience",
  rateExpectation: "rate_expectation",
  rateCurrency: "rate_currency",
  summary: "summary",
};

// Keyed off the raw request keys, not the parsed output: parsed null means
// "clear", which is indistinguishable from "absent" after the schema runs.
function toProfileRowPatch(
  rawInput: Record<string, unknown>,
  parsed: Record<string, unknown>,
): ProfileUpdate {
  const row: ProfileUpdate = {};
  for (const field of UPDATABLE_PROFILE_FIELDS) {
    if (field in rawInput) {
      (row as Record<string, unknown>)[PROFILE_COLUMN_BY_FIELD[field]] = parsed[field] ?? null;
    }
  }
  return row;
}

export async function updateProfile(
  supabase: Client,
  profileId: string,
  organizationId: string,
  input: unknown,
): Promise<ProfileMutationResult> {
  const rawInput = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

  const parsed = updateProfileSchema.safeParse({ ...rawInput, profileId });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireProfileManagerUser();
  if (gate.denied) {
    return gate.denied;
  }

  const patch = toProfileRowPatch(rawInput, parsed.data as Record<string, unknown>);
  if (Object.keys(patch).length === 0) {
    return invalidInput("No fields to update.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        status: 409,
        error: "A profile with this email already exists.",
      };
    }
    console.error("updateProfile: profiles update failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (data.length === 0) {
    return { success: false, status: 404, error: "Profile not found." };
  }

  await logActivity({
    supabase,
    organizationId,
    actorUserId: gate.user.id,
    actorName: actorNameFromUser(gate.user),
    action: "profile_updated",
    description: `Updated profile "${parsed.data.fullName}"`,
    entityType: "profile",
    entityId: profileId,
    entityLabel: parsed.data.fullName,
  });

  return { success: true, profileId };
}

// Soft delete — profiles.deleted_at stays null in the DB for live rows and
// every read filters it, so archiving hides the profile (and its CVs) from
// lists, discovery, and dashboards immediately while the row — and its
// leads, matches, and assignment history — survives. Same convention as
// profile_cvs and job comments.
export async function archiveProfile(
  supabase: Client,
  profileId: string,
  organizationId: string,
): Promise<ProfileMutationResult> {
  const parsed = archiveProfileSchema.safeParse({ profileId });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireProfileManagerUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .select("id, full_name");

  if (error) {
    console.error("archiveProfile: profiles update failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (data.length === 0) {
    return { success: false, status: 404, error: "Profile not found." };
  }

  await logActivity({
    supabase,
    organizationId,
    actorUserId: gate.user.id,
    actorName: actorNameFromUser(gate.user),
    action: "profile_archived",
    description: `Archived profile "${data[0].full_name}"`,
    entityType: "profile",
    entityId: profileId,
    entityLabel: data[0].full_name,
  });

  return { success: true, profileId };
}

// A user may own multiple profiles (profiles.user_id is no longer UNIQUE),
// but each profile still belongs to at most one user — user_id is a single
// FK per row, so assigning a user here simply re-points this profile.
export async function setProfileAssignment(
  supabase: Client,
  profileId: string,
  organizationId: string,
  input: unknown,
): Promise<ProfileMutationResult> {
  const parsed = setProfileAssignmentSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    profileId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireProfileManagerUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { userId } = parsed.data;

  // The assigned user must belong to the same org. profiles.user_id only FKs
  // to users(id), so without this check an admin could attach a cross-org
  // user to a profile — making that user the RLS owner of another tenant's
  // profile (and its CVs), which their discovery feed would then surface.
  // Admins are excluded from assignment entirely (they manage profiles, they
  // don't own them).
  let assignedUserName: string | null = null;
  if (userId) {
    const { data: userRow } = await supabase
      .from("users")
      .select("id, full_name, roles(name)")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!userRow) {
      return { success: false, status: 400, error: "Selected user not found." };
    }
    if (userRow.roles?.name === "Admin") {
      return { success: false, status: 400, error: "Admins cannot be assigned to profiles." };
    }
    assignedUserName = userRow.full_name;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ user_id: userId })
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .select("id, full_name");

  if (error) {
    if (error.code === "23503") {
      return {
        success: false,
        status: 400,
        error: "Selected user not found.",
      };
    }
    console.error("setProfileAssignment: profiles update failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (data.length === 0) {
    return { success: false, status: 404, error: "Profile not found." };
  }

  const profileName = data[0].full_name;
  await logActivity({
    supabase,
    organizationId,
    actorUserId: gate.user.id,
    actorName: actorNameFromUser(gate.user),
    action: assignedUserName ? "profile_assigned" : "profile_unassigned",
    description: assignedUserName
      ? `Assigned profile "${profileName}" to ${assignedUserName}`
      : `Unassigned profile "${profileName}"`,
    entityType: "profile",
    entityId: profileId,
    entityLabel: profileName,
    metadata: { userId },
  });

  return { success: true, profileId };
}

const CV_HARD_MAX_BYTES = 10_485_760;
const CV_HARD_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// CVs are stored in Cloudinary (raw assets); profile_cvs.storage_path holds
// the CDN secure URL returned by the upload. Seeded rows keep dummy paths
// until real files are uploaded through the app.
export async function uploadProfileCv(
  supabase: Client,
  profileId: string,
  organizationId: string,
  formData: FormData,
): Promise<ProfileMutationResult> {
  const parsed = uploadProfileCvSchema.safeParse({
    profileId,
    file: formData.get("file"),
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const { file } = parsed.data;
  const gate = await requireProfileManagerUser();
  if (gate.denied) {
    return gate.denied;
  }

  // profile_cvs has no org column — verify the profile itself belongs to
  // the org so a cross-org profile id can't be used to attach a CV.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!profileRow) {
    return { success: false, status: 404, error: "Profile not found." };
  }

  if (file.size > CV_HARD_MAX_BYTES) {
    return {
      success: false,
      status: 400,
      error: `File exceeds the maximum size of ${Math.round(CV_HARD_MAX_BYTES / 1024 / 1024)}MB.`,
    };
  }

  if (!CV_HARD_ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      status: 400,
      error: "File type not allowed. Upload a PDF, DOC, or DOCX.",
    };
  }

  const cvId = crypto.randomUUID();

  // Read once and reuse: Cloudinary needs these bytes, and so does the parse
  // scheduled at the end of this function — re-downloading the file we just
  // uploaded would be a pointless round trip.
  const fileBytes = Buffer.from(await file.arrayBuffer());

  let upload: CvUploadResult;
  try {
    upload = await uploadCvFile(
      fileBytes,
      profileId,
      cvId,
      file.name,
    );
  } catch (uploadError) {
    console.error("uploadProfileCv: Cloudinary upload failed", uploadError);
    return {
      success: false,
      status: 500,
      error:
        uploadError instanceof CloudinaryConfigError
          ? uploadError.message
          : "Something went wrong uploading the file. Please try again.",
    };
  }

  // parse_status is left to its column default ('pending') — the DB owns that
  // default, and restating it here would be one more thing to drift.
  const { error: insertError } = await supabase.from("profile_cvs").insert({
    id: cvId,
    profile_id: profileId,
    storage_path: upload.secureUrl,
    file_name: file.name,
    file_type: file.type,
    file_size_bytes: file.size,
  });

  if (insertError) {
    console.error("uploadProfileCv: profile_cvs insert failed", insertError);
    // The file is already on Cloudinary — remove it so a failed row insert
    // doesn't leave an orphaned asset behind.
    try {
      await deleteCvFile(upload.publicId);
    } catch (cleanupError) {
      console.error("uploadProfileCv: Cloudinary cleanup failed", cleanupError);
    }
    return {
      success: false,
      status: 500,
      error: "Something went wrong saving the CV record. Please try again.",
    };
  }

  // The row is stored and the response can go out now; the parse fills in
  // parse_status / parsed_data moments later. Scheduled only after a
  // successful insert, so there is always a row to write the result to.
  scheduleCvParse({ cvId, fileType: file.type, buffer: fileBytes });

  await logActivity({
    supabase,
    organizationId,
    actorUserId: gate.user.id,
    actorName: actorNameFromUser(gate.user),
    action: "profile_cv_uploaded",
    description: `Uploaded CV "${file.name}" to profile "${profileRow.full_name}"`,
    entityType: "profile_cv",
    entityId: cvId,
    entityLabel: file.name,
  });

  return { success: true, profileId };
}

// Extracts the Cloudinary public_id from a CDN secure URL. Raw assets embed
// the id in the path (…/upload/v<version>/<public_id>), so the upload's
// public_id can be recovered from the URL stored in profile_cvs.storage_path.
// Seeded rows carry dummy paths that are not Cloudinary URLs — returns null.
function publicIdFromCvUrl(secureUrl: string): string | null {
  if (!secureUrl.startsWith("https://res.cloudinary.com")) {
    return null;
  }

  const uploadMarker = "/upload/";
  const uploadIndex = secureUrl.indexOf(uploadMarker);
  if (uploadIndex === -1) {
    return null;
  }

  const publicId = secureUrl
    .slice(uploadIndex + uploadMarker.length)
    .replace(/^v\d+\//, "");

  if (!publicId) {
    return null;
  }

  try {
    return decodeURIComponent(publicId);
  } catch {
    return publicId;
  }
}

// CVs are soft-deleted (deleted_at) — RLS grants update but not delete on
// profile_cvs, and hard deletes would break job_profile_matches FK rows.
// The Cloudinary asset is removed best-effort afterwards; seeded rows with
// dummy storage paths are simply unlinked.
export async function deleteProfileCv(
  supabase: Client,
  profileId: string,
  cvId: string,
  organizationId: string,
): Promise<ProfileMutationResult> {
  const parsed = deleteProfileCvSchema.safeParse({ profileId, cvId });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireProfileManagerUser();
  if (gate.denied) {
    return gate.denied;
  }

  // Same org gate as uploadProfileCv: profile_cvs rows belong to a profile,
  // so a cross-org profile id must not resolve its CVs.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!profileRow) {
    return { success: false, status: 404, error: "Profile not found." };
  }

  const { data: cvRow, error: selectError } = await supabase
    .from("profile_cvs")
    .select("storage_path, file_name")
    .eq("id", cvId)
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (selectError) {
    console.error("deleteProfileCv: profile_cvs select failed", selectError);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (!cvRow) {
    return { success: false, status: 404, error: "CV not found." };
  }

  const { error: deleteError } = await supabase
    .from("profile_cvs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cvId)
    .eq("profile_id", profileId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("deleteProfileCv: profile_cvs update failed", deleteError);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  const publicId = publicIdFromCvUrl(cvRow.storage_path);
  if (publicId) {
    try {
      await deleteCvFile(publicId);
    } catch (cleanupError) {
      console.error(
        "deleteProfileCv: Cloudinary cleanup failed",
        cleanupError,
      );
    }
  }

  await logActivity({
    supabase,
    organizationId,
    actorUserId: gate.user.id,
    actorName: actorNameFromUser(gate.user),
    action: "profile_cv_deleted",
    description: `Deleted CV "${cvRow.file_name}" from profile "${profileRow.full_name}"`,
    entityType: "profile_cv",
    entityId: cvId,
    entityLabel: cvRow.file_name,
  });

  return { success: true, profileId };
}
