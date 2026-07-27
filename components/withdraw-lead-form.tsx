"use client";

import { useActionState } from "react";
import { withdrawLead, type WithdrawLeadState } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: WithdrawLeadState = {};

export function WithdrawLeadForm({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(withdrawLead, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="leadId" value={leadId} />
      <Input
        name="reason"
        type="text"
        placeholder="Reason for withdrawing…"
        required
        className="sm:w-64"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Withdrawing…" : "Withdraw"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
