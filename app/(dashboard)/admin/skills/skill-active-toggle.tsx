"use client";

import { useActionState } from "react";
import { setSkillActive, type SkillActionState } from "@/lib/actions/skills";
import { Button } from "@/components/ui/button";

const initialState: SkillActionState = {};

export function SkillActiveToggle({
  skillId,
  isActive,
}: {
  skillId: string;
  isActive: boolean;
}) {
  const [state, formAction, isPending] = useActionState(setSkillActive, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="skillId" value={skillId} />
      {/* Submits the explicit target state, never "flip current" — same
          contract as EngineerActiveToggle. */}
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : isActive ? "Deactivate" : "Reactivate"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
