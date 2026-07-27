import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteUserForm } from "./invite-user-form";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .order("name");

  // Two FKs exist between user_roles and profiles (user_id, assigned_by),
  // so the embed relationship must be disambiguated by constraint name.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, user_roles!user_roles_user_id_fkey(id)")
    .order("created_at", { ascending: false });

  const unassigned = (profiles ?? []).filter(
    (profile) => (profile.user_roles?.length ?? 0) === 0,
  );

  return (
    <div className="mx-auto max-w-xl p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Invite a user</CardTitle>
          <CardDescription>
            Send an invite email with a role assignment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm roles={roles ?? []} />
        </CardContent>
      </Card>

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
