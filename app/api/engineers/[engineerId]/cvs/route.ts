import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { engineerMutationResponse } from "@/lib/api/engineers-response";
import { isSameOrigin } from "@/lib/api/guard";
import { uploadEngineerCv } from "@/lib/services/engineers";
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected a multipart/form-data body." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const result = await uploadEngineerCv(supabase, engineerId, formData);

  if (result.success) {
    revalidatePath("/engineers");
    revalidatePath(`/engineers/${engineerId}`);
  }

  return engineerMutationResponse(result);
}
