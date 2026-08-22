import { NextResponse } from "next/server";
import { readOrganizationId } from "@/lib/api/organization";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's organization ID from database
  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!userData?.organization_id) {
    return NextResponse.json(
      { error: "User organization not found." },
      { status: 400 }
    );
  }

  const organizationId = userData.organization_id;

  // Verify the supplied organization ID (if any) matches the user's organization
  const suppliedOrgId = readOrganizationId(request);
  if (suppliedOrgId && suppliedOrgId !== organizationId) {
    return NextResponse.json(
      { error: "Organization mismatch." },
      { status: 403 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { password } = body;
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password is required and must be at least 8 characters." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: password,
  });

  if (error) {
    console.error("Failed to update password:", error);
    return NextResponse.json(
      { error: "Failed to update password." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
