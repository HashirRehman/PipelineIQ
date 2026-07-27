"use client";

import { useActionState } from "react";
import { markApplied, type MarkAppliedState } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";

const initialState: MarkAppliedState = {};

export function MarkAppliedForm({ matchId }: { matchId: string }) {
  const [state, formAction, isPending] = useActionState(markApplied, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="matchId" value={matchId} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Marking…" : "Mark Applied"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
