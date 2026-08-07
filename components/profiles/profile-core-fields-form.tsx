"use client";

import { useState } from "react";
import {
  createProfileRequest,
  updateProfileRequest,
  type ProfileCoreFieldsPayload,
  type ProfileMutationResponse,
} from "@/lib/api/profiles-client";
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

type ProfileFieldValues = {
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

const BLANK_VALUES: ProfileFieldValues = {
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

function readPayload(form: HTMLFormElement): ProfileCoreFieldsPayload {
  const formData = new FormData(form);
  const value = (name: keyof ProfileCoreFieldsPayload) =>
    String(formData.get(name) ?? "");

  return {
    fullName: value("fullName"),
    email: value("email"),
    phone: value("phone"),
    location: value("location"),
    seniorityLevelId: value("seniorityLevelId"),
    yearsExperience: value("yearsExperience"),
    rateExpectation: value("rateExpectation"),
    rateCurrency: value("rateCurrency"),
    summary: value("summary"),
  };
}

export function ProfileCoreFieldsForm({
  mode,
  profileId,
  initialValues = BLANK_VALUES,
  seniorityLevels,
  submitLabel,
  onSuccess,
}: {
  mode: "create" | "update";
  profileId?: string;
  initialValues?: ProfileFieldValues;
  seniorityLevels: SeniorityLevel[];
  submitLabel: string;
  onSuccess?: (profileId: string) => void;
}) {
  const [state, setState] = useState<ProfileMutationResponse>({});
  const [isPending, setIsPending] = useState(false);
  const [seedValues] = useState(initialValues);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const payload = readPayload(event.currentTarget);

    setIsPending(true);
    setState({});

    const result =
      mode === "update" && profileId
        ? await updateProfileRequest(profileId, payload)
        : await createProfileRequest(payload);

    setState(result);
    setIsPending(false);

    if (!result.success || !result.profileId) {
      return;
    }

    if (onSuccess) {
      onSuccess(result.profileId);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={seedValues.fullName} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={seedValues.email}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={seedValues.phone} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={seedValues.location} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="seniorityLevelId">Seniority level</Label>
          <Select
            name="seniorityLevelId"
            defaultValue={seedValues.seniorityLevelId || undefined}
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
            defaultValue={seedValues.yearsExperience}
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
            defaultValue={seedValues.rateExpectation}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rateCurrency">Rate currency</Label>
          <Input
            id="rateCurrency"
            name="rateCurrency"
            maxLength={3}
            defaultValue={seedValues.rateCurrency}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea id="summary" name="summary" defaultValue={seedValues.summary} rows={4} />
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
