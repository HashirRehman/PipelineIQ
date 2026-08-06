import { NextResponse } from "next/server";
import type { EngineerMutationResult } from "@/lib/services/engineers";

export function engineerMutationResponse(result: EngineerMutationResult) {
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    engineerId: result.engineerId,
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
