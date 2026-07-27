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
type Skill = { id: string; name: string };

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

// Shared by both createEngineer and updateEngineer — engineerId's presence
// is what distinguishes create from edit mode (a hidden input only renders
// when editing an existing row).
export function EngineerCoreFieldsForm({
  action,
  engineerId,
  initialValues = BLANK_VALUES,
  initialSkillIds = [],
  seniorityLevels,
  skills,
  submitLabel,
  redirectOnSuccess = false,
}: {
  action: (
    state: EngineerActionState,
    formData: FormData,
  ) => Promise<EngineerActionState>;
  engineerId?: string;
  initialValues?: EngineerFieldValues;
  initialSkillIds?: string[];
  seniorityLevels: SeniorityLevel[];
  skills: Skill[];
  submitLabel: string;
  // Create-mode only (sub-chunk 3) — edit mode (sub-chunk 2) omits this and
  // keeps its already-verified stay-on-page-and-show-"Saved." behavior.
  redirectOnSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const router = useRouter();

  useEffect(() => {
    if (redirectOnSuccess && state.success && state.engineerId) {
      router.push(`/engineers/${state.engineerId}`);
    }
  }, [redirectOnSuccess, state.success, state.engineerId, router]);

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
            // Base UI's Select.Value resolves a selected label from this
            // `items` map — without it, it falls back to the raw value
            // whenever the popup list hasn't mounted yet (i.e. edit mode's
            // initial render with defaultValue set, before the user has
            // ever opened the dropdown), showing the level's UUID instead
            // of its name.
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

      <div className="flex flex-col gap-2">
        <Label>Skills</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {skills.map((skill) => (
            <label key={skill.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="skillIds"
                value={skill.id}
                defaultChecked={initialSkillIds.includes(skill.id)}
                className="size-4 rounded border-input"
              />
              {skill.name}
            </label>
          ))}
          {skills.length === 0 && (
            <p className="text-sm text-muted-foreground">No skills defined yet.</p>
          )}
        </div>
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
