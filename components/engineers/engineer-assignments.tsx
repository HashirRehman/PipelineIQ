"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignEngineerToBdRequest,
  unassignEngineerFromBdRequest,
} from "@/lib/api/engineers-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type Assignment = {
  bdUserId: string;
  fullName: string;
  email: string;
};

function useAssignmentRefresh(onChanged?: () => void) {
  const router = useRouter();

  return () => {
    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  };
}

function UnassignButton({
  engineerId,
  bdUserId,
  onChanged,
}: {
  engineerId: string;
  bdUserId: string;
  onChanged?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const refresh = useAssignmentRefresh(onChanged);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setError(null);
    setIsPending(true);

    const result = await unassignEngineerFromBdRequest(engineerId, bdUserId);

    setIsPending(false);

    if (!result.success) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
        className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
      >
        {isPending ? "Removing…" : "Remove"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

function AssignForm({
  engineerId,
  candidates,
  onChanged,
}: {
  engineerId: string;
  candidates: { id: string; fullName: string; email: string }[];
  onChanged?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const refresh = useAssignmentRefresh(onChanged);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const bdUserId = String(
      new FormData(event.currentTarget).get("bdUserId") ?? "",
    );

    setError(null);
    setIsPending(true);

    const result = await assignEngineerToBdRequest(engineerId, bdUserId);

    setIsPending(false);

    if (!result.success) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    refresh();
  };

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every BD Executive is already assigned to this engineer.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select name="bdUserId" required>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Select a BD Executive" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.fullName} ({candidate.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Assigning…" : "Assign"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
export function EngineerAssignments({
  engineerId,
  assignments,
  candidates,
  isAdmin,
  onChanged,
}: {
  engineerId: string;
  assignments: Assignment[];
  candidates: { id: string; fullName: string; email: string }[];
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No BD Executives currently assigned.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {assignments.map((assignment) => (
            <li
              key={assignment.bdUserId}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info-foreground text-[11px] font-semibold text-primary-foreground">
                  {getInitials(assignment.fullName)}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {assignment.fullName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {assignment.email}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <UnassignButton
                  engineerId={engineerId}
                  bdUserId={assignment.bdUserId}
                  onChanged={onChanged}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="mt-4 border-t border-border pt-4">
          <AssignForm
            engineerId={engineerId}
            candidates={candidates}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  );
}
