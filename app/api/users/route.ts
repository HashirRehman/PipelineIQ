import { NextRequest, NextResponse } from "next/server";
import { createClient, getCachedIsAdmin, getCachedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export interface ApiAppUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "lead" | "bd";
  status: "active" | "inactive";
  joinedAt: string;
}

export interface ApiRole {
  id: string;
  name: string;
}

function mapRoleNameToUserRole(roleName?: string): "admin" | "lead" | "bd" {
  if (!roleName) return "bd";
  const normalized = roleName.toLowerCase().trim();
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("lead") || normalized.includes("manager")) return "lead";
  return "bd";
}

export async function GET() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, is_active, created_at, user_roles!user_roles_user_id_fkey(roles(name, id))")
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  if (profilesRes.error) {
    console.error("GET /api/users profiles query error:", profilesRes.error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }

  const rawProfiles = profilesRes.data ?? [];
  const roles: ApiRole[] = rolesRes.data ?? [];

  const users: ApiAppUser[] = rawProfiles.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRoleObj = p.user_roles as any;
    const dbRoleName = userRoleObj?.[0]?.roles?.name ?? "";
    const role = mapRoleNameToUserRole(dbRoleName);
    const joinedAt = p.created_at ? p.created_at.split("T")[0] : new Date().toISOString().split("T")[0];

    return {
      id: p.id,
      name: p.full_name || p.email.split("@")[0] || "User",
      email: p.email,
      role,
      status: p.is_active ? "active" : "inactive",
      joinedAt,
    };
  });

  const currentUserObj = users.find((u) => u.id === user.id) ?? {
    id: user.id,
    name: user.user_metadata?.full_name || user.email || "Admin",
    email: user.email ?? "",
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, role } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and Email are required." }, { status: 400 });
    }

    // Lookup matching database role ID
    const { data: roles } = await supabase.from("roles").select("id, name");
    let targetRoleId: string | undefined;

    if (roles && roles.length > 0) {
      const match = roles.find((r) => {
        const n = r.name.toLowerCase();
        if (role === "admin") return n.includes("admin");
        if (role === "lead") return n.includes("lead") || n.includes("manager");
        return n.includes("bd") || n.includes("executive");
      });
      targetRoleId = match?.id ?? roles[0].id;
    }

    if (!targetRoleId) {
      return NextResponse.json({ error: "No target role found in database." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: name },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      }
    );

    if (inviteError) {
      if (inviteError.code === "email_exists") {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }
      console.error("POST /api/users inviteUserByEmail error:", inviteError);
      return NextResponse.json({ error: inviteError.message || "Failed to invite user." }, { status: 500 });
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: inviteData.user.id,
      role_id: targetRoleId,
      assigned_by: user.id,
    });

    if (roleError) {
      console.error("POST /api/users user_roles insert error:", roleError);
    }

    const newUser: ApiAppUser = {
      id: inviteData.user.id,
      name,
      email,
      role: (role as "admin" | "lead" | "bd") || "bd",
      status: "active",
      joinedAt: new Date().toISOString().split("T")[0],
    };

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, status } = body;

    if (!userId || typeof status !== "string") {
      return NextResponse.json({ error: "userId and status are required." }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot change your own active status." }, { status: 400 });
    }

    const isActive = status === "active";

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId);

    if (error) {
      console.error("PATCH /api/users status update error:", error);
      return NextResponse.json({ error: error.message || "Failed to update user status." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH /api/users error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
