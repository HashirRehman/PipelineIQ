import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { profileMutationResponse } from "@/lib/api/profiles-response";
import { isSameOrigin } from "@/lib/api/guard";
import { deleteProfileCv } from "@/lib/services/profiles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ profileId: string; cvId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { profileId, cvId } = await context.params;

  const supabase = await createClient();
  const result = await deleteProfileCv(supabase, profileId, cvId);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}
