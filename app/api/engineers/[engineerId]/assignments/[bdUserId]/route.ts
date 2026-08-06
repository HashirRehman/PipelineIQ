import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { engineerMutationResponse } from "@/lib/api/engineers-response";
import { isSameOrigin } from "@/lib/api/guard";
import { unassignEngineerFromBd } from "@/lib/services/engineers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ engineerId: string; bdUserId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { engineerId, bdUserId } = await context.params;

  const supabase = await createClient();
  const result = await unassignEngineerFromBd(supabase, engineerId, bdUserId);

  if (result.success) {
    revalidatePath("/engineers");
    revalidatePath(`/engineers/${engineerId}`);
  }

  return engineerMutationResponse(result);
}
