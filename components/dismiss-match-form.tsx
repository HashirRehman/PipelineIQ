"use client";

import { useActionState } from "react";
import { dismissMatch, type DismissMatchState } from "@/lib/actions/discovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: DismissMatchState = {};

export function DismissMatchForm({ matchId }: { matchId: string }) {
  const [state, formAction, isPending] = useActionState(dismissMatch, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="matchId" value={matchId} />
      <Input
        name="reason"
        type="text"
        placeholder="Reason for dismissing…"
        required
        className="sm:w-56"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Dismissing…" : "Dismiss"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
