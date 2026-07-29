import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteUserForm } from "../invite-user-form";

export default async function NewUserPage() {
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    redirect("/admin/users");
  }

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Invite a user</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User details</CardTitle>
          <CardDescription>
            Send an invite email with a role assignment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm roles={roles ?? []} redirectOnSuccess />
        </CardContent>
      </Card>
    </div>
  );
}
