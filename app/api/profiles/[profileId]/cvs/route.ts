import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { profileMutationResponse } from "@/lib/api/profiles-response";
import { isSameOrigin } from "@/lib/api/guard";
import { uploadProfileCv } from "@/lib/services/profiles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { profileId } = await context.params;

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
  const result = await uploadProfileCv(supabase, profileId, formData);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}
