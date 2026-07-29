"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { inviteUser, type InviteUserState } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: InviteUserState = {};

export function InviteUserForm({
  roles,
  redirectOnSuccess = false,
}: {
  roles: { id: string; name: string }[];
  redirectOnSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    inviteUser,
    initialState,
  );
  const router = useRouter();

  useEffect(() => {
    if (redirectOnSuccess && state.success) {
      router.push("/admin/users");
    }
  }, [redirectOnSuccess, state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" type="text" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="roleId">Role</Label>
        <Select
          name="roleId"
          items={roles.map((role) => ({ value: role.id, label: role.name }))}
          required
        >
          <SelectTrigger id="roleId" className="w-full">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-success-foreground">
          Invite sent.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-2 w-full">
        {isPending ? "Sending invite…" : "Send invite"}
      </Button>
    </form>
  );
}
