import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  profileMutationResponse,
  readJsonBody,
} from "@/lib/api/profiles-response";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { setProfileAssignment } from "@/lib/services/profiles";
import { createClient, getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
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

  const { body, response: badBody } = await readJsonBody(request);
  if (badBody) {
    return badBody;
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const result = await setProfileAssignment(supabase, profileId, org.organizationId, body);

  if (result.success) {
    revalidatePath("/");
  }

  return profileMutationResponse(result);
}
