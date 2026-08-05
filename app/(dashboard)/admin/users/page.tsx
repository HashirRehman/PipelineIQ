import { createClient } from "@/lib/supabase/server";
import { UsersPageClient, type UserItem, type RoleItem } from "./users-client";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profilesRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, is_active, created_at, user_roles!user_roles_user_id_fkey(roles(name))",
      )
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  const rawProfiles = profilesRes.data ?? [];
  const roles: RoleItem[] = rolesRes.data ?? [];

  const initialUsers: UserItem[] = rawProfiles.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRoleObj = p.user_roles as any;
    const roleName = userRoleObj?.[0]?.roles?.name ?? "Unassigned";

    return {
      id: p.id,
      email: p.email,
      full_name: p.full_name || "",
      is_active: p.is_active ?? true,
      created_at: p.created_at,
      role_name: roleName,
    };
  });

  return (
    <UsersPageClient
      initialUsers={initialUsers}
      roles={roles}
      currentUserId={user?.id ?? ""}
    />
  );
}
