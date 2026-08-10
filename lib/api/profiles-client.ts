import { apiDelete, apiPatch, apiPost } from "@/lib/api/client";

export type ProfileMutationResponse = {
  success?: boolean;
  profileId?: string;
  error?: string;
};
export type ProfileCoreFieldsPayload = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  seniorityLevelId: string;
  yearsExperience: string;
  rateExpectation: string;
  rateCurrency: string;
  summary: string;
};

async function toResult(
  request: Promise<ProfileMutationResponse>,
): Promise<ProfileMutationResponse> {
  try {
    return await request;
  } catch (requestError) {
    console.error("profile API request failed", requestError);

    return {
      error:
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again.",
    };
  }
}

const profilePath = (profileId: string) =>
  `/api/profiles/${encodeURIComponent(profileId)}`;

export function createProfileRequest(payload: ProfileCoreFieldsPayload) {
  return toResult(apiPost<ProfileMutationResponse>("/api/profiles", payload));
}

export function updateProfileRequest(
  profileId: string,
  payload: ProfileCoreFieldsPayload,
) {
  return toResult(
    apiPatch<ProfileMutationResponse>(profilePath(profileId), payload),
  );
}

export function setProfileActiveRequest(profileId: string, isActive: boolean) {
  return toResult(
    apiPatch<ProfileMutationResponse>(`${profilePath(profileId)}/status`, {
      isActive,
    }),
  );
}

export function setProfileAssignmentRequest(
  profileId: string,
  userId: string | null,
) {
  return toResult(
    apiPatch<ProfileMutationResponse>(
      `${profilePath(profileId)}/assignment`,
      { userId },
    ),
  );
}

export function uploadProfileCvRequest(profileId: string, formData: FormData) {
  return toResult(
    apiPost<ProfileMutationResponse>(`${profilePath(profileId)}/cvs`, formData),
  );
}

/**
 * Re-runs the parse for one CV.
 *
 * Used both to retry a failed parse and to parse a CV that never was (older
 * rows, or an upload whose background parse didn't land). Runs server-side
 * inline, so the response reflects the actual outcome.
 */
export function parseProfileCvRequest(profileId: string, cvId: string) {
  return toResult(
    apiPost<ProfileMutationResponse>(
      `${profilePath(profileId)}/cvs/${encodeURIComponent(cvId)}/parse`,
      {},
    ),
  );
}

export function deleteProfileCvRequest(profileId: string, cvId: string) {
  return toResult(
    apiDelete<ProfileMutationResponse>(
      `${profilePath(profileId)}/cvs/${encodeURIComponent(cvId)}`,
    ),
  );
}
