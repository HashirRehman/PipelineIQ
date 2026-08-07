import { NextResponse } from "next/server";
import type { ProfileMutationResult } from "@/lib/services/profiles";

export function profileMutationResponse(result: ProfileMutationResult) {
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    profileId: result.profileId,
    ...(result.error ? { error: result.error } : {}),
  });
}

export async function readJsonBody(
  request: Request,
): Promise<{ body: unknown; response?: never } | { body?: never; response: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return {
      response: NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 },
      ),
    };
  }
}
