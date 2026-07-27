"use client";

import { useActionState } from "react";
import { setEngineerActive, type EngineerActionState } from "@/lib/actions/engineers";
import { Button } from "@/components/ui/button";

const initialState: EngineerActionState = {};

export function EngineerActiveToggle({
  engineerId,
  isActive,
}: {
  engineerId: string;
  isActive: boolean;
}) {
  const [state, formAction, isPending] = useActionState(setEngineerActive, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="engineerId" value={engineerId} />
      {/* Submits the explicit target state, never "flip current" — matches
          setEngineerActive's own contract. */}
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : isActive ? "Deactivate" : "Activate"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
