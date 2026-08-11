import { NextResponse } from "next/server";
import { logAudit } from "@/lib/api/audit";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { resolveSiteUrl } from "@/lib/api/site-url";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleUserKey } from "@/lib/auth/roles";
import { createUserSchema, deleteUserSchema, updateUserSchema } from "@/lib/validation/schemas";

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

export interface UsersApiResponse {
  users: ApiAppUser[];
  roles: ApiRole[];
  currentUser: ApiAppUser | null;
  isAdmin: boolean;
  canInvite: boolean;
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

  const perms = await getCachedRolePermissions();
  if (!perms.canViewUsers) {
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
      role: roleUserKey(roleName),
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

  // isAdmin gates row actions; canInvite gates the invite button. BD Managers
  // see the roster only.
  const response: UsersApiResponse = {
    users,
    roles,
    currentUser: currentUserObj,
    isAdmin: perms.isAdmin,
    canInvite: perms.canInviteUsers,
  };

  return NextResponse.json(response);
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

  const perms = await getCachedRolePermissions();
  if (!perms.canInviteUsers) {
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

  // The target must also be in the project's Auth redirect allow list, or
  // Supabase silently falls back to site_url and the invite lands on the login
  // page. Fails closed: an invite link must never be built from an unvalidated
  // Host header (an unset NEXT_PUBLIC_SITE_URL would otherwise mail a literal
  // "undefined/auth/confirm" or, worse, an attacker-controlled origin).
  const siteUrl = resolveSiteUrl(request);
  if (!siteUrl) {
    console.error("api/users: NEXT_PUBLIC_SITE_URL is not set; invite not sent.");
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${siteUrl}/auth/confirm`,
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
      { error: "User invited, but account setup failed. Contact an administrator." },
      { status: 500 },
    );
  }

  // Audit: an invitation was issued.
  await logAudit({
    supabase,
    organizationId: org.organizationId,
    actorUserId: user.id,
    action: "invite_sent",
    targetUserId: inviteData.user.id,
    targetEmail: email,
    metadata: { role: role.name },
    request,
  });

  const newUser: ApiAppUser = {
    id: inviteData.user.id,
    name,
    email,
    roleId: role.id,
    role: roleUserKey(role.name),
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

  const perms = await getCachedRolePermissions();

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

  // BD Managers mirror Admins except user management: editing/deactivating/
  // deleting OTHER team members is Admin-only, but anyone may edit their own
  // name (RLS users_update grants exactly that — own full_name only). The
  // self-check below still blocks own status/role changes.
  const isSelfNameEdit =
    userId === user.id &&
    name !== undefined &&
    status === undefined &&
    roleId === undefined;
  if (!perms.canManageUsers && !isSelfNameEdit) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

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

  // Audit: what changed on the member row (name / status / role).
  await logAudit({
    supabase,
    organizationId: org.organizationId,
    actorUserId: user.id,
    action: "user_updated",
    targetUserId: userId,
    metadata: {
      ...(name !== undefined ? { name } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(role ? { role: role.name } : {}),
    },
    request,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = await getCachedRolePermissions();
  if (!perms.canManageUsers) {
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

  const parsed = deleteUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const { userId } = parsed.data;

  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  // The target must be a member of the caller's org (users_select lets
  // admins see every row, so this lookup passes RLS).
  const { data: target, error: targetError } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", userId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (targetError) {
    console.error("api/users: delete target query failed", targetError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Permanent: kill the auth identity first so a partially-failed cleanup
  // can never leave a login-able account behind. "Not found" is tolerated
  // so a retry after a mid-way failure still completes the cleanup.
  const { error: authDeleteError } =
    await createAdminClient().auth.admin.deleteUser(userId);
  if (authDeleteError && !/not found/i.test(authDeleteError.message)) {
    console.error("api/users: auth delete failed", authDeleteError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Delete the public users row (admin-only, via the users_delete policy).
  // The schema's FKs do the unlinking — comments cascade, while leads,
  // application states, and profiles set user_id to NULL (migration 14) —
  // so only the user and their comments are removed; profile data survives.
  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("organization_id", org.organizationId);
  if (deleteError) {
    console.error("api/users: users delete failed", deleteError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Audit: the member (and their auth identity) was permanently removed.
  // The target's users row is already gone, so target_user_id must NOT be
  // set — audit_logs.target_user_id is an FK and a new row can't reference
  // a deleted user (on delete set null only protects existing rows).
  // Identity is captured via the pre-delete email, with the id preserved
  // in metadata so it isn't lost.
  await logAudit({
    supabase,
    organizationId: org.organizationId,
    actorUserId: user.id,
    action: "user_deleted",
    targetUserId: null,
    targetEmail: target?.email,
    metadata: { deletedUserId: userId },
    request,
  });

  return NextResponse.json({ success: true });
}
