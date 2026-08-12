import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, allowed_email_domain")
    .eq("id", org.organizationId)
    .maybeSingle();

  if (error || !data) {
    console.error("api/organization/settings: GET failed", error);
    return NextResponse.json(
      { error: "Failed to fetch organization settings." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    allowedEmailDomain: data.allowed_email_domain ?? null,
  });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = await getCachedRolePermissions();
  if (!perms.isAdmin) {
    return NextResponse.json(
      { error: "Only organization administrators can modify domain settings." },
      { status: 403 },
    );
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  let body: { allowedEmailDomain?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let cleanedDomain: string | null = null;
  if (typeof body.allowedEmailDomain === "string") {
    const trimmed = body.allowedEmailDomain.trim().toLowerCase();
    cleanedDomain = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    if (cleanedDomain === "") {
      cleanedDomain = null;
    }
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("organizations")
    .update({
      allowed_email_domain: cleanedDomain,
      updated_at: new Date().toISOString(),
    })
    .eq("id", org.organizationId);

  if (error) {
    console.error("api/organization/settings: PATCH failed", error);
    return NextResponse.json(
      { error: "Failed to update organization settings." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    allowedEmailDomain: cleanedDomain,
  });
}
