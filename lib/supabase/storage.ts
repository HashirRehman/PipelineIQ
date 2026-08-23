// Module 1 — CV file storage in Supabase Storage (private `profile-cvs` bucket).
//
// Replaces lib/cloudinary.ts. profile_cvs.storage_path now holds an OBJECT
// KEY in this bucket, not a CDN URL:
//
//     <profileId>/<cvId>-<safeFileName>
//
// The profile-cvs bucket is private with no client-facing storage.objects
// policies — access control lives entirely in the Route Handlers / services
// that call these functions (org/role checks happen before any of these run),
// not in Postgres. Every function here constructs its own service-role
// client internally rather than accepting one from the caller: an
// authenticated user's own key has no bucket access at all, so there is no
// valid client a caller could pass other than the service role — taking one
// as a parameter would just be a way to get it wrong.
import { StorageApiError } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";

export const PROFILE_CVS_BUCKET = "profile-cvs";

/**
 * How long a profile-detail download link stays valid.
 *
 * The link is signed fresh on every GET /api/profiles/[profileId], but the
 * response is cached client-side (react-query — see
 * components/query-provider.tsx), so a link can reach the user several
 * minutes after it was signed. The TTL has to outlive that window plus the
 * time someone spends reading the CV panel before clicking Download, and no
 * longer: a signed URL is a bearer token, not re-checked against RLS, so it
 * keeps working after a role change or unassignment for exactly this long.
 */
export const CV_DOWNLOAD_URL_TTL_SECONDS = 900;

export class CvStorageError extends Error {}

// Same sanitizer the Cloudinary public_id used, so nothing about the naming
// scheme changes for the user. Lowercased profile id for a canonical path
// regardless of how the id was cased in a route param.
export function cvObjectPath(profileId: string, cvId: string, fileName: string): string {
  const safeFileName = fileName.replace(/[^a-z0-9._-]/gi, "_");
  return `${profileId.toLowerCase()}/${cvId}-${safeFileName}`;
}

// Rows whose storage_path is still an absolute URL: pre-migration Cloudinary
// links that scripts/migrateCloudinaryCvsToStorage.cjs hasn't reached yet (or,
// after that one-off script is deleted, never will). Treated as "no object
// here" rather than passed to the Storage API as a key.
function isLegacyUrl(storagePath: string): boolean {
  return /^https?:\/\//i.test(storagePath);
}

// storage-api has returned both 400 and 404 for a missing object across
// versions, but a bare 400 also covers unrelated failures (bad key, auth,
// malformed request) — only treat it as "not found" when the code/message
// actually says so, so a real error doesn't get silently swallowed.
function isNotFound(error: unknown): boolean {
  if (!(error instanceof StorageApiError)) return false;
  if (error.code === "NoSuchKey" || error.status === 404) return true;
  return error.status === 400 && /not.?found/i.test(error.message ?? "");
}

// Uploads a CV and returns the object key to store in profile_cvs.storage_path.
export async function uploadCvFile(
  input: {
    buffer: Buffer;
    profileId: string;
    cvId: string;
    fileName: string;
    contentType: string;
  },
): Promise<{ path: string }> {
  const path = cvObjectPath(input.profileId, input.cvId, input.fileName);

  const { error } = await createAdminClient().storage.from(PROFILE_CVS_BUCKET).upload(path, input.buffer, {
    // Required, not cosmetic: a Buffer body with no contentType is stored as
    // text/plain;charset=UTF-8, which the bucket's allowed_mime_types rejects.
    contentType: input.contentType,
    cacheControl: "3600",
    // No upsert — cvId is freshly generated per upload, so a collision means
    // something is wrong and should fail rather than overwrite other bytes.
    upsert: false,
  });

  if (error) {
    throw new CvStorageError(`Storage upload failed for ${path}: ${error.message}`);
  }

  return { path };
}

// Best-effort cleanup: on CV delete, and when a profile_cvs insert fails after
// the bytes are already stored. Removing a key that isn't there is a no-op.
export async function deleteCvFile(path: string): Promise<void> {
  if (isLegacyUrl(path)) return;

  const { error } = await createAdminClient().storage.from(PROFILE_CVS_BUCKET).remove([path]);
  if (error) {
    throw new CvStorageError(`Storage delete failed for ${path}: ${error.message}`);
  }
}

// Only for re-parses and the cron sweep; uploads pass their buffer in
// directly. The thrown messages end up in profile_cvs.parse_error and are
// shown to the user, so they stay plain-language.
export async function downloadCvFile(path: string): Promise<Buffer> {
  if (isLegacyUrl(path)) {
    throw new CvStorageError(
      "This CV's file still points at the old external URL and hasn't been moved into storage yet.",
    );
  }

  const { data, error } = await createAdminClient().storage.from(PROFILE_CVS_BUCKET).download(path);

  if (error) {
    throw new CvStorageError(
      isNotFound(error)
        ? "This CV has no stored file (nothing exists at its storage path)."
        : `Could not download the stored file (${error.message}).`,
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

// A short-lived download link for the profile detail response. `download`
// sets Content-Disposition: attachment with the original file name — the
// equivalent of Cloudinary's fl_attachment — so a PDF saves instead of
// opening inline. Returns null rather than throwing: seeded rows point at
// nothing, and a missing file must not fail the whole profile GET.
export async function createCvDownloadUrl(
  path: string,
  fileName: string,
): Promise<string | null> {
  if (isLegacyUrl(path)) return null;

  const { data, error } = await createAdminClient().storage
    .from(PROFILE_CVS_BUCKET)
    .createSignedUrl(path, CV_DOWNLOAD_URL_TTL_SECONDS, { download: fileName });

  if (error) {
    // Expected for seeded rows; anything else is worth seeing in the log.
    if (!isNotFound(error)) {
      console.error(`createCvDownloadUrl: could not sign ${path}`, error);
    }
    return null;
  }

  return data.signedUrl;
}
