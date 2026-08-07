// Server-side Cloudinary client for CV file storage.
//
// Credentials are read from server env vars only (CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) and never exposed to the
// browser — uploads happen through the admin-gated API route, not via
// unsigned client presets. Import this module from server code only.
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";

export class CloudinaryConfigError extends Error {}

function getCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new CloudinaryConfigError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

export type CvUploadResult = {
  publicId: string;
  secureUrl: string;
};

// Uploads a CV as a raw asset under profiles/<profileId>/ and returns the
// canonical public_id + CDN secure URL to store in profile_cvs.storage_path.
export async function uploadCvFile(
  buffer: Buffer,
  profileId: string,
  cvId: string,
  fileName: string,
): Promise<CvUploadResult> {
  const client = getCloudinary();

  const safeFileName = fileName.replace(/[^a-z0-9._-]/gi, "_");

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: `profiles/${profileId}`,
        public_id: `${cvId}-${safeFileName}`,
      },
      (error, uploadResult) =>
        error || !uploadResult
          ? reject(error ?? new Error("Cloudinary upload returned no result."))
          : resolve(uploadResult),
    );
    stream.end(buffer);
  });

  return { publicId: result.public_id, secureUrl: result.secure_url };
}

// Best-effort cleanup of an uploaded asset (e.g. when the profile_cvs row
// insert fails after the file was already uploaded).
export async function deleteCvFile(publicId: string): Promise<void> {
  const client = getCloudinary();
  await client.uploader.destroy(publicId, { resource_type: "raw" });
}
