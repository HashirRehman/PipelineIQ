"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProfileAssignmentRequest } from "@/lib/api/profiles-client";
import type { AssignableUser } from "@/app/api/profiles/route";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Sentinel value for the "Unassigned" option — Base UI requires non-empty
// item values, so null is mapped from this instead.
const UNASSIGNED = "__unassigned__";

export function ProfileAssignment({
  profileId,
  assignedUserId,
  assignedUserName,
  users,
  isAdmin,
  onChanged,
}: {
  profileId: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  users: AssignableUser[];
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [displayUserId, setDisplayUserId] = useState<string | null>(
    assignedUserId,
  );
  const [prevAssignedUserId, setPrevAssignedUserId] = useState(assignedUserId);

  if (!isPending && assignedUserId !== prevAssignedUserId) {
    setPrevAssignedUserId(assignedUserId);
    setDisplayUserId(assignedUserId);
  }

  const handleValueChange = async (value: string | null) => {
    if (isPending) {
      return;
    }

    const next = value === UNASSIGNED || value === null ? null : value;

    setError(null);
    setIsPending(true);
    setDisplayUserId(next); // optimistic — the select reflects intent

    const result = await setProfileAssignmentRequest(profileId, next);

    setIsPending(false);

    if (!result.success) {
      setDisplayUserId(assignedUserId); // revert on failure
      setError(
        result.error ?? "Something went wrong. Please try again.",
      );
      return;
    }

    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  };

  if (!isAdmin) {
    return (
      <p className="text-sm text-foreground">
        {assignedUserName ?? "Unassigned"}
      </p>
    );
  }

  const items = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...users.map((user) => ({
      value: user.id,
      label: user.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={displayUserId ?? UNASSIGNED}
        onValueChange={handleValueChange}
        items={items}
        disabled={isPending}
      >
        <SelectTrigger className="w-full" aria-label="Assigned user">
          <SelectValue placeholder="Select a user" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>

          {users.map((user) => {
            const assignedElsewhere =
              user.assignedProfileId !== null &&
              user.assignedProfileId !== profileId;

            return (
              <SelectItem
                key={user.id}
                value={user.id}
                disabled={assignedElsewhere}
              >
                <span className="truncate">{user.name}</span>
                <span className="truncate text-muted-foreground">
                  {user.email}
                  {assignedElsewhere
                    ? " — assigned to another profile"
                    : ""}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
