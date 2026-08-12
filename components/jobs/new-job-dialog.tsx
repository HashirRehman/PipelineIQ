"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { apiPost } from "@/lib/api/client";

export type NewJobProfile = { id: string; name: string };
export type NewJobStage = { id: string; name: string; orderIndex: number };

type JobState = "applied" | "lead" | "dismissed";

const JOB_STATES: readonly { value: JobState; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "lead", label: "Lead" },
  { value: "dismissed", label: "Dismissed" },
];

/** Today's date as "YYYY-MM-DD" in the user's local time (date inputs use it). */
function localToday(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const BLANK_FORM = {
  title: "",
  company: "",
  location: "",
  url: "",
  source: "",
  skills: "",
  budget: "",
  expCompensation: "",
  developer: "",
  comment: "",
};

/**
 * Manually add a job from the Pipeline page. One job, one chosen profile
 * (defaulted when the caller has exactly one), and a state for that profile:
 * Applied / Lead (with a pipeline stage + comment) / Dismissed. Every other
 * profile sees the job as a suggestion in Discovery.
 */
export function NewJobDialog({
  open,
  onOpenChange,
  onCreated,
  profiles,
  pipelineStages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  profiles: NewJobProfile[];
  pipelineStages: NewJobStage[];
}) {
  const [form, setForm] = useState(BLANK_FORM);
  const [date, setDate] = useState(localToday);
  const [profileId, setProfileId] = useState("");
  const [state, setState] = useState<JobState>("applied");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Reset on every closed → open transition so a cancelled edit never bleeds
  // into the next add. profiles is in the deps for lint; the prevOpen guard
  // makes the reset fire only on the transition.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setForm(BLANK_FORM);
      setDate(localToday());
      setState("applied");
      setStageId("");
      // Single assigned profile → default it (the requirement); several →
      // leave the choice to the user.
      setProfileId(profiles.length === 1 ? profiles[0].id : "");
      setError(null);
      setIsPending(false);
    }
    prevOpen.current = open;
  }, [open, profiles]);

  const set = (key: keyof typeof BLANK_FORM) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = () => onOpenChange(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    if (!profileId) {
      setError("Select a profile.");
      return;
    }
    if (state === "lead" && !stageId) {
      setError("Select a stage for the lead.");
      return;
    }

    const skillList = form.skills
      .split(/[\n,]+/)
      .map((skill) => skill.trim())
      .filter(Boolean);

    setIsPending(true);
    setError(null);
    try {
      await apiPost<{ success: boolean }>("/api/jobs", {
        title: form.title,
        company: form.company,
        location: form.location,
        url: form.url,
        date,
        source: form.source,
        skills: skillList.length > 0 ? skillList : undefined,
        budget: form.budget,
        expCompensation: form.expCompensation,
        developer: form.developer,
        profileId,
        state,
        pipelineStageId: state === "lead" ? stageId : undefined,
        comment: state === "lead" ? form.comment : undefined,
      });
      setForm(BLANK_FORM);
      setState("applied");
      setStageId("");
      setProfileId(profiles.length === 1 ? profiles[0].id : "");
      onCreated();
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="sm:min-w-[50vw] max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>
            The job is added for your selected profile; everyone else sees it as a
            suggestion in Discovery until they apply to it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="jobTitle">Title *</Label>
              <Input
                id="jobTitle"
                value={form.title}
                onChange={(e) => set("title")(e.target.value)}
                placeholder="e.g. Senior React Developer"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => set("company")(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => set("location")(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="skills">Skills</Label>
              <Textarea
                id="skills"
                value={form.skills}
                onChange={(e) => set("skills")(e.target.value)}
                rows={2}
                placeholder="Comma-separated (e.g. React, Node.js, PostgreSQL)"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="date">Date applied *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={form.source}
                  onChange={(e) => set("source")(e.target.value)}
                  placeholder="e.g. LinkedIn, referral"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="budget">Budget</Label>
                <Input
                  id="budget"
                  value={form.budget}
                  onChange={(e) => set("budget")(e.target.value)}
                  placeholder="e.g. $5k–$8k / mo"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expCompensation">Exp. Compensation</Label>
                <Input
                  id="expCompensation"
                  value={form.expCompensation}
                  onChange={(e) => set("expCompensation")(e.target.value)}
                  placeholder="e.g. $80–100 / hr"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="developer">Developer</Label>
              <Input
                id="developer"
                value={form.developer}
                onChange={(e) => set("developer")(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profileId">Profile *</Label>
              <Select value={profileId} onValueChange={(v) => { if (v) setProfileId(v) }} name="profileId" required>
                <SelectTrigger id="profileId" className="w-full">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {profiles.length === 1
                  ? "Your only profile is selected, so this job is added for it."
                  : "Picked for the profile this job is for; the rest of the team sees it as a suggestion."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="state">State *</Label>
              <Select
                value={state}
                onValueChange={(v) => { if (v) setState(v as JobState) }}
                name="state"
                required
              >
                <SelectTrigger id="state" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state === "lead" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="stage">Stage *</Label>
                  <Select value={stageId} onValueChange={(v) => { if (v) setStageId(v) }} name="stage" required>
                    <SelectTrigger id="stage" className="w-full">
                      <SelectValue placeholder="Select a stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="comment">Notes</Label>
                  <Textarea
                    id="comment"
                    value={form.comment}
                    onChange={(e) => set("comment")(e.target.value)}
                    rows={3}
                    placeholder="Lead notes (e.g. reply received, next step, deadline…)"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="url">URL</Label>
              {/* Deliberately NOT type="url": the browser would reject a bare
                  domain ("example.com/jobs") as invalid, blocking submission
                  before the server's https:// auto-prefix ever runs. text +
                  inputMode=url keeps the mobile URL keyboard while letting the
                  route normalize the scheme. */}
              <Input
                id="url"
                type="text"
                inputMode="url"
                value={form.url}
                onChange={(e) => set("url")(e.target.value)}
                placeholder="https://…"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding…" : "Add job"}
              </Button>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
