"use client";

import { useActionState } from "react";
import { createSkill, type SkillActionState } from "@/lib/actions/skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SkillActionState = {};

export function SkillCreateForm() {
  const [state, formAction, isPending] = useActionState(createSkill, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="skillName">Name</Label>
        <Input id="skillName" name="name" type="text" required />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p role="status" className="text-sm text-success-foreground">
          Skill added.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-2 w-full sm:w-auto">
        {isPending ? "Adding…" : "Add skill"}
      </Button>
    </form>
  );
}
