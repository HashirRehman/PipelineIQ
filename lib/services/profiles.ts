import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getCachedIsAdmin, getCachedUser } from "@/lib/supabase/server";
import {
  CloudinaryConfigError,
  deleteCvFile,
  uploadCvFile,
  type CvUploadResult,
} from "@/lib/cloudinary";
import {
  createProfileSchema,
  deleteProfileCvSchema,
  setProfileActiveSchema,
  setProfileAssignmentSchema,
  updateProfileSchema,
  uploadProfileCvSchema,
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

// Mirrors the rest of the app: is_admin comes from the JWT claims baked in
// by the custom_access_token_hook migration (getCachedIsAdmin reads them
// locally via cached JWKS — no live RPC round trip), same as
// app/api/users/route.ts and middleware.ts. RLS still re-checks
// public.is_admin() live at query time regardless.
async function requireAdminUser(): Promise<AdminGate> {
  const user = await getCachedUser();

  if (!user) {
    return { denied: { success: false, status: 401, error: NOT_AUTHORIZED } };
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return { denied: { success: false, status: 403, error: NOT_AUTHORIZED } };
  }

  return { user };
}

// profiles.organization_id is NOT NULL — resolve it from the acting user's
// own row, falling back to the seeded org (matches app/api/discovery).
async function resolveOrganizationId(
  supabase: Client,
  userId: string,
): Promise<string | null> {
  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (userRow?.organization_id) {
    return userRow.organization_id;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "Recurso Labs")
    .maybeSingle();

  return org?.id ?? null;
}

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
  input: unknown,
): Promise<ProfileMutationResult> {
  const parsed = createProfileSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser();
  if (gate.denied) {
    return gate.denied;
  }

  const organizationId = await resolveOrganizationId(supabase, gate.user.id);
  if (!organizationId) {
    console.error("createProfile: no organization resolved for user", gate.user.id);
    return {
      success: false,
      status: 500,
      error: "No organization found for this account.",
    };
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

  return { success: true, profileId: data.id };
}

export async function updateProfile(
  supabase: Client,
  profileId: string,
  input: unknown,
): Promise<ProfileMutationResult> {
  const parsed = updateProfileSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    profileId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(toProfileRow(parsed.data))
    .eq("id", profileId)
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

  return { success: true, profileId };
}

export async function setProfileActive(
  supabase: Client,
  profileId: string,
  input: unknown,
): Promise<ProfileMutationResult> {
  const parsed = setProfileActiveSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    profileId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { isActive } = parsed.data;

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .select("id");

  if (error) {
    console.error("setProfileActive: profiles update failed", error);
    return {
      success: false,
      status: 500,
      error: "Something went wrong. Please try again.",
    };
  }

  if (data.length === 0) {
    return { success: false, status: 404, error: "Profile not found." };
  }

  return { success: true, profileId };
}

// One user can own at most one profile: profiles.user_id is UNIQUE, so the
// database enforces the 1:1 assignment. A second assignment attempt surfaces
// as a 23505 unique violation, which we translate into a friendly 409.
export async function setProfileAssignment(
  supabase: Client,
  profileId: string,
  input: unknown,
): Promise<ProfileMutationResult> {
  const parsed = setProfileAssignmentSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    profileId,
  });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ user_id: parsed.data.userId })
    .eq("id", profileId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        status: 409,
        error:
          "This user is already assigned to another profile. Unassign them there first.",
      };
    }
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
  const gate = await requireAdminUser();
  if (gate.denied) {
    return gate.denied;
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

  let upload: CvUploadResult;
  try {
    upload = await uploadCvFile(
      Buffer.from(await file.arrayBuffer()),
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
): Promise<ProfileMutationResult> {
  const parsed = deleteProfileCvSchema.safeParse({ profileId, cvId });

  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message);
  }

  const gate = await requireAdminUser();
  if (gate.denied) {
    return gate.denied;
  }

  const { data: cvRow, error: selectError } = await supabase
    .from("profile_cvs")
    .select("storage_path")
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

  return { success: true, profileId };
}
