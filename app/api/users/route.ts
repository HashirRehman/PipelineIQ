import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
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

interface ProfileWithRole {
  user_roles?: {
    role_id?: string | null;
    roles?: { name?: string | null } | null;
  }[] | null;
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

export async function GET() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, is_active, created_at, user_roles!user_roles_user_id_fkey(role_id, roles(name, id))",
      )
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  if (profilesRes.error) {
    console.error("api/users: profiles query failed", profilesRes.error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (rolesRes.error) {
    console.error("api/users: roles query failed", rolesRes.error);
  }

  const roles: ApiRole[] = rolesRes.data ?? [];

  const users: ApiAppUser[] = (profilesRes.data ?? []).map((p) => {
    const assigned = (p as unknown as ProfileWithRole).user_roles?.[0];
    const roleId = assigned?.role_id ?? null;
    const roleName = assigned?.roles?.name ?? "";

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

  return NextResponse.json({
    users,
    roles,
    currentUser: currentUserObj,
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

  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: inviteData.user.id,
    role_id: role.id,
    assigned_by: user.id,
  });

  if (roleError) {
    console.error("api/users: user_roles insert failed", roleError);
    return NextResponse.json(
      { error: "User invited, but role assignment failed — contact an administrator." },
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

  const profileUpdates: { full_name?: string; is_active?: boolean } = {};
  if (name !== undefined) profileUpdates.full_name = name;
  if (status !== undefined) profileUpdates.is_active = status === "active";

  const hasProfileUpdates = Object.keys(profileUpdates).length > 0;

  if (hasProfileUpdates) {
    const { data, error } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId)
      .select("id");

    if (error) {
      console.error("api/users: profiles update failed", error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "User not found or not accessible." }, { status: 404 });
    }
  }

  if (role && !hasProfileUpdates) {
    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: "User not found or not accessible." }, { status: 404 });
    }
  }

  if (role) {
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("api/users: user_roles delete failed", deleteError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }

    const { error: insertError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role_id: role.id,
      assigned_by: user.id,
    });

    if (insertError) {
      console.error("api/users: user_roles insert failed", insertError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
