import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Two FKs exist between user_roles and profiles (user_id, assigned_by),
  // so the embed relationship must be disambiguated by constraint name.
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, is_active, created_at, user_roles!user_roles_user_id_fkey(roles(name))",
    )
    .order("created_at", { ascending: false });

  const list = profiles ?? [];
  const unassigned = list.filter((profile) => (profile.user_roles?.length ?? 0) === 0);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Everyone with access to this platform.
          </p>
        </div>
        <Button render={<Link href="/admin/users/new" />}>Invite user</Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No users yet.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((profile) => {
                const roleName = profile.user_roles?.[0]?.roles?.name;
                return (
                  <tr key={profile.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {profile.full_name || "—"}
                      </div>
                      <div className="text-muted-foreground">{profile.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {roleName ? (
                        <Badge variant="outline">{roleName}</Badge>
                      ) : (
                        <StatusBadge variant="warning">No role assigned</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={profile.is_active ? "success" : "neutral"}>
                        {profile.is_active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="mt-8 rounded-lg bg-warning p-4 text-sm text-warning-foreground">
          <p className="font-medium">
            {unassigned.length} invited user
            {unassigned.length > 1 ? "s" : ""} with no role assigned:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {unassigned.map((profile) => (
              <li key={profile.id}>{profile.email}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
