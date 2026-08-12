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
import { CountryCombobox } from "@/components/ui/country-combobox";
import { CurrencyCombobox } from "@/components/ui/currency-combobox";
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

function SteppedNumberInput({
  id,
  name,
  defaultValue,
  min,
}: {
  id: string;
  name: string;
  defaultValue: string;
  min?: number;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  // Built-in browser spinners, stepping by whole numbers. When the current
  // value is fractional (e.g. legacy "7.5 years" profiles), fall back to
  // step="any" so the value stays valid — a hard step="1" would make those
  // profiles a step-mismatch and block saving them. Typed decimals (0.5
  // years, $12.50) always remain valid either way.
  const step = Number.isInteger(Number(value)) ? "1" : "any";

  return (
    <Input
      id={id}
      name={name}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

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
  stacked = false,
  onCancel,
  onSuccess,
}: {
  mode: "create" | "update";
  profileId?: string;
  initialValues?: ProfileFieldValues;
  seniorityLevels: SeniorityLevel[];
  submitLabel: string;
  stacked?: boolean;
  onCancel?: () => void;
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

      <div className={stacked ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
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
          {/* Country dropdown with search — the ISO list from lib/countries.
              allowCustom keeps pre-existing free-text values ("Lahore,
              Pakistan") intact until the user picks a country; the hidden
              input submits the value with the form. */}
          <CountryCombobox
            id="location"
            name="location"
            defaultValue={seedValues.location}
            placeholder="Select a country"
            allowCustom
          />
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
          <SteppedNumberInput
            id="yearsExperience"
            name="yearsExperience"
            defaultValue={seedValues.yearsExperience}
            min={0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rateExpectation">Rate expectation</Label>
          <SteppedNumberInput
            id="rateExpectation"
            name="rateExpectation"
            defaultValue={seedValues.rateExpectation}
            min={0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rateCurrency">Rate currency</Label>
          {/* Currency dropdown with search — the ISO 4217 list from
              lib/currencies. Stores the 3-letter code (what the server
              validates); allowCustom keeps legacy values intact. */}
          <CurrencyCombobox
            id="rateCurrency"
            name="rateCurrency"
            defaultValue={seedValues.rateCurrency}
            placeholder="Select a currency"
            allowCustom
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea id="summary" name="summary" defaultValue={seedValues.summary} rows={4} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p role="status" className="text-sm text-success-foreground">
          Saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
