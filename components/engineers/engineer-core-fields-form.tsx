"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EngineerActionState } from "@/lib/actions/engineers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SeniorityLevel = { id: string; name: string };

type EngineerFieldValues = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  seniorityLevelId: string;
  yearsExperience: string;
  rateExpectation: string;
  rateCurrency: string;
  summary: string;
};

const BLANK_VALUES: EngineerFieldValues = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  seniorityLevelId: "",
  yearsExperience: "",
  rateExpectation: "",
  rateCurrency: "USD",
  summary: "",
};

export function EngineerCoreFieldsForm({
  action,
  engineerId,
  initialValues = BLANK_VALUES,
  seniorityLevels,
  submitLabel,
  redirectOnSuccess = false,
  onSuccess,
}: {
  action: (
    state: EngineerActionState,
    formData: FormData,
  ) => Promise<EngineerActionState>;
  engineerId?: string;
  initialValues?: EngineerFieldValues;
  seniorityLevels: SeniorityLevel[];
  submitLabel: string;
  redirectOnSuccess?: boolean;
  onSuccess?: (engineerId: string) => void;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const router = useRouter();

  useEffect(() => {
    if (!state.success || !state.engineerId) {
      return;
    }

    if (onSuccess) {
      onSuccess(state.engineerId);
      return;
    }

    if (redirectOnSuccess) {
      router.push(`/engineers/${state.engineerId}`);
    }
  }, [
    state.success,
    state.engineerId,
    onSuccess,
    redirectOnSuccess,
    router,
  ]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {engineerId && <input type="hidden" name="engineerId" value={engineerId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={initialValues.fullName} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={initialValues.email}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={initialValues.phone} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={initialValues.location} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="seniorityLevelId">Seniority level</Label>
          <Select
            name="seniorityLevelId"
            defaultValue={initialValues.seniorityLevelId || undefined}
            items={seniorityLevels.map((level) => ({ value: level.id, label: level.name }))}
            required
          >
            <SelectTrigger id="seniorityLevelId" className="w-full">
              <SelectValue placeholder="Select a level" />
            </SelectTrigger>
            <SelectContent>
              {seniorityLevels.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="yearsExperience">Years experience</Label>
          <Input
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            step="0.1"
            min="0"
            defaultValue={initialValues.yearsExperience}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rateExpectation">Rate expectation</Label>
          <Input
            id="rateExpectation"
            name="rateExpectation"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initialValues.rateExpectation}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rateCurrency">Rate currency</Label>
          <Input
            id="rateCurrency"
            name="rateCurrency"
            maxLength={3}
            defaultValue={initialValues.rateCurrency}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea id="summary" name="summary" defaultValue={initialValues.summary} rows={4} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p role="status" className="text-sm text-success-foreground">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
