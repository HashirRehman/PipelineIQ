import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  engineerMutationResponse,
  readJsonBody,
} from "@/lib/api/engineers-response";
import { isSameOrigin } from "@/lib/api/guard";
import { assignEngineerToBd } from "@/lib/services/engineers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ engineerId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { engineerId } = await context.params;

  const { body, response: badBody } = await readJsonBody(request);
  if (badBody) {
    return badBody;
  }

  const supabase = await createClient();
  const result = await assignEngineerToBd(supabase, engineerId, body);

  if (result.success) {
    revalidatePath("/engineers");
    revalidatePath(`/engineers/${engineerId}`);
  }

  return engineerMutationResponse(result);
}
