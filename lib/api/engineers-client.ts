import { apiDelete, apiPatch, apiPost } from "@/lib/api/client";

export type EngineerMutationResponse = {
  success?: boolean;
  engineerId?: string;
  error?: string;
};
export type EngineerCoreFieldsPayload = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  seniorityLevelId: string;
  yearsExperience: string;
  rateExpectation: string;
  rateCurrency: string;
  summary: string;
  skillNames: string;
};

async function toResult(
  request: Promise<EngineerMutationResponse>,
): Promise<EngineerMutationResponse> {
  try {
    return await request;
  } catch (requestError) {
    console.error("engineer API request failed", requestError);

    return {
      error:
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again.",
    };
  }
}

const engineerPath = (engineerId: string) =>
  `/api/engineers/${encodeURIComponent(engineerId)}`;

export function createEngineerRequest(payload: EngineerCoreFieldsPayload) {
  return toResult(apiPost<EngineerMutationResponse>("/api/engineers", payload));
}

export function updateEngineerRequest(
  engineerId: string,
  payload: EngineerCoreFieldsPayload,
) {
  return toResult(
    apiPatch<EngineerMutationResponse>(engineerPath(engineerId), payload),
  );
}

export function setEngineerActiveRequest(engineerId: string, isActive: boolean) {
  return toResult(
    apiPatch<EngineerMutationResponse>(`${engineerPath(engineerId)}/status`, {
      isActive,
    }),
  );
}

export function assignEngineerToBdRequest(engineerId: string, bdUserId: string) {
  return toResult(
    apiPost<EngineerMutationResponse>(`${engineerPath(engineerId)}/assignments`, {
      bdUserId,
    }),
  );
}

export function unassignEngineerFromBdRequest(
  engineerId: string,
  bdUserId: string,
) {
  return toResult(
    apiDelete<EngineerMutationResponse>(
      `${engineerPath(engineerId)}/assignments/${encodeURIComponent(bdUserId)}`,
    ),
  );
}

export function uploadEngineerCvRequest(engineerId: string, formData: FormData) {
  return toResult(
    apiPost<EngineerMutationResponse>(`${engineerPath(engineerId)}/cvs`, formData),
  );
}
