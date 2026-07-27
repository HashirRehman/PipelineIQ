"use client";

import { useActionState } from "react";
import { reapplyLead, type ReapplyLeadState } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";

const initialState: ReapplyLeadState = {};

export function ReapplyLeadForm({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(reapplyLead, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="leadId" value={leadId} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Reapplying…" : "Reapply"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
