import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedIsAdmin, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema, updateUserSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export interface ApiAppUser {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  role: "admin" | "lead" | "bd";
  status: "active" | "inactive";
  joinedAt: string;
}

export interface ApiRole {
  id: string;
  name: string;
}

function mapRoleNameToUserRole(roleName?: string | null): ApiAppUser["role"] {
  if (!roleName) return "bd";
  const normalized = roleName.toLowerCase().trim();
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("lead") || normalized.includes("manager")) return "lead";
  return "bd";
}

async function findRoleById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roleId: string,
): Promise<
  | { ok: true; role: { id: string; name: string } }
  | { ok: false; reason: "query_failed" | "not_found" }
> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .maybeSingle();

  if (error) {
    console.error("api/users: roles query failed", error);
    return { ok: false, reason: "query_failed" };
  }
  if (!data) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, role: data };
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const [usersRes, rolesRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, is_active, created_at, role_id, roles(name, id)")
      .eq("organization_id", org.organizationId)
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  if (usersRes.error) {
    console.error("api/users: users query failed", usersRes.error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (rolesRes.error) {
    console.error("api/users: roles query failed", rolesRes.error);
  }

  const roles: ApiRole[] = rolesRes.data ?? [];

  const users: ApiAppUser[] = (usersRes.data ?? []).map((p) => {
    const roleId = p.role_id;
    const roleName = p.roles?.name ?? "";

    const joinedAt = p.created_at
      ? p.created_at.split("T")[0]
      : new Date().toISOString().split("T")[0];

    return {
      id: p.id,
      name: p.full_name || p.email.split("@")[0] || "User",
      email: p.email,
      roleId,
      role: mapRoleNameToUserRole(roleName),
      status: p.is_active ? "active" : "inactive",
      joinedAt,
    };
  });

  const currentUserObj = users.find((u) => u.id === user.id) ?? {
    id: user.id,
    name: user.user_metadata?.full_name || user.email || "Admin",
    email: user.email ?? "",
    roleId: null,
    role: "admin" as const,
    status: "active" as const,
    joinedAt: new Date().toISOString().split("T")[0],
  };

  // GET is already admin-gated above (403 for non-admins), so a successful
  // response means the caller is an admin — surface that so the UI can show
  // the admin-only controls (invite, edit, deactivate/activate).
  return NextResponse.json({
    users,
    roles,
    currentUser: currentUserObj,
    isAdmin: true,
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { name, email, roleId } = parsed.data;

  const roleResult = await findRoleById(supabase, roleId);
  if (!roleResult.ok) {
    if (roleResult.reason === "not_found") {
      return NextResponse.json({ error: "Selected role not found." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
  const role = roleResult.role;

  const adminClient = createAdminClient();

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    });

  if (inviteError) {
    if (inviteError.code === "email_exists") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 },
      );
    }
    console.error("api/users: inviteUserByEmail failed", inviteError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const { error: usersError } = await supabase.from("users").upsert(
    {
      id: inviteData.user.id,
      organization_id: org.organizationId,
      full_name: name,
      email,
      role_id: role.id,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (usersError) {
    console.error("api/users: users insert failed", usersError);
    return NextResponse.json(
      { error: "User invited, but account setup failed — contact an administrator." },
      { status: 500 },
    );
  }

  const newUser: ApiAppUser = {
    id: inviteData.user.id,
    name,
    email,
    roleId: role.id,
    role: mapRoleNameToUserRole(role.name),
    status: "active",
    joinedAt: new Date().toISOString().split("T")[0],
  };

  return NextResponse.json({ success: true, user: newUser });
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

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { userId, name, status, roleId } = parsed.data;

  if (userId === user.id && (status !== undefined || roleId !== undefined)) {
    return NextResponse.json(
      { error: "You cannot change your own status or role." },
      { status: 400 },
    );
  }

  let role: { id: string; name: string } | null = null;
  if (roleId) {
    const roleResult = await findRoleById(supabase, roleId);
    if (!roleResult.ok) {
      if (roleResult.reason === "not_found") {
        return NextResponse.json({ error: "Selected role not found." }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
    role = roleResult.role;
  }

  const userUpdates: { full_name?: string; is_active?: boolean; role_id?: string } = {};
  if (name !== undefined) userUpdates.full_name = name;
  if (status !== undefined) userUpdates.is_active = status === "active";
  if (role) userUpdates.role_id = role.id;

  const { data, error } = await supabase
    .from("users")
    .update(userUpdates)
    .eq("id", userId)
    .eq("organization_id", org.organizationId)
    .select("id");

  if (error) {
    console.error("api/users: users update failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "User not found or not accessible." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
