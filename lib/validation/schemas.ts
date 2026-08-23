import { z } from "zod";
import { ENGAGEMENT_TYPE_VALUES } from "@/lib/constants";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Full name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  roleId: z.uuid("Select a role."),
});

export const updateUserSchema = z
  .object({
    userId: z.uuid(),
    name: z.string().trim().min(1, "Full name is required.").optional(),
    status: z.enum(["active", "inactive"]).optional(),
    roleId: z.uuid("Select a role.").optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.status !== undefined || data.roleId !== undefined,
    { message: "Provide a name, status, or role to update." },
  );

export const deleteUserSchema = z.object({
  userId: z.uuid(),
});

export const pipelineStageStateSchema = z.enum(["active", "paused", "closed"]);

export const createPipelineStageSchema = z.object({
  name: z.string().trim().min(1, "Stage name is required."),
  state: pipelineStageStateSchema,
});

export const updatePipelineStageSchema = z
  .object({
    stageId: z.uuid(),
    name: z.string().trim().min(1, "Stage name is required.").optional(),
    state: pipelineStageStateSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.state !== undefined, {
    message: "Provide a name or state to update.",
  });

export const reorderPipelineStagesSchema = z.object({
  stageIds: z.array(z.uuid()).min(1, "No stages to reorder."),
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(256, "Password must be at most 256 characters."),
    confirmPassword: z.string().max(256),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  // bcrypt (Supabase Auth's password hasher) silently truncates input at 72
  // bytes — over-long passwords would be compared post-truncation, so two
  // distinct passwords could hash identically. Reject rather than truncate
  // (byte length, not chars, since multi-byte characters inflate past 72).
  .refine(
    (data) => new TextEncoder().encode(data.password).length <= 72,
    { message: "Password must be at most 72 bytes.", path: ["password"] },
  );

const optionalNonNegativeNumber = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return Number(value);
  })
  .refine(
    (value) => value === undefined || (Number.isFinite(value) && value >= 0),
    "Must be zero or greater.",
  );

const optionalTrimmedText = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

// Optional inbound/outbound. The form and the import mapper both send "" for
// "not set", so an empty string is a valid way to say "leave it null" rather
// than a validation failure.
const engagementTypeSchema = z
  .union([z.enum(ENGAGEMENT_TYPE_VALUES), z.literal("")])
  .nullish()
  .transform((value) => (value ? value : undefined));

export const profileCoreFieldsSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.email("Enter a valid email address."),
  phone: optionalTrimmedText,
  location: optionalTrimmedText,
  seniorityLevelId: z.uuid("Select a seniority level."),
  yearsExperience: optionalNonNegativeNumber,
  rateExpectation: optionalNonNegativeNumber,
  rateCurrency: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value.toUpperCase() : "USD"))
    .refine((value) => value.length === 3, "Currency must be a 3-letter code."),
  summary: optionalTrimmedText,
});

export const createProfileSchema = profileCoreFieldsSchema;

// Absent means "leave alone"; an explicit "" or null means "clear".
const clearableText = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

const clearableNumber = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value === null || value === "" ? null : Number(value)))
  .refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0),
    "Must be zero or greater.",
  );

// All optional, so a full payload still validates.
export const updateProfileSchema = z.object({
  profileId: z.uuid(),
  fullName: z.string().trim().min(1, "Full name is required.").optional(),
  email: z.email("Enter a valid email address.").optional(),
  phone: clearableText.optional(),
  location: clearableText.optional(),
  seniorityLevelId: z.uuid("Select a seniority level.").optional(),
  yearsExperience: clearableNumber.optional(),
  rateExpectation: clearableNumber.optional(),
  // No "USD" fallback: it would rewrite the currency of any edit that omits it.
  rateCurrency: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value.length === 3, "Currency must be a 3-letter code.")
    .optional(),
  summary: clearableText.optional(),
});

export const UPDATABLE_PROFILE_FIELDS = [
  "fullName",
  "email",
  "phone",
  "location",
  "seniorityLevelId",
  "yearsExperience",
  "rateExpectation",
  "rateCurrency",
  "summary",
] as const;

export type UpdatableProfileField = (typeof UPDATABLE_PROFILE_FIELDS)[number];

export const archiveProfileSchema = z.object({
  profileId: z.uuid(),
});

export const uploadProfileCvSchema = z.object({
  profileId: z.uuid(),
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, "Select a file to upload."),
});

export const deleteProfileCvSchema = z.object({
  profileId: z.uuid(),
  cvId: z.uuid(),
});

export const setProfileAssignmentSchema = z.object({
  profileId: z.uuid(),
  // null (or "" from the select's unassigned option) clears the assignment.
  userId: z
    .union([z.uuid("Select a user."), z.null(), z.literal("")])
    .transform((value) => (value === "" ? null : value)),
});

// Actions target one or more of the acting user's assigned profiles — a
// user may own several profiles, so the drawer asks which profile(s) to
// use (or all of them) before acting.
const profileIdsSchema = z
  .array(z.uuid("Select a profile."))
  .min(1, "Select at least one profile.");

export const dismissJobSchema = z.object({
  jobId: z.uuid(),
  profileIds: profileIdsSchema,
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

export const markAppliedSchema = z.object({
  jobId: z.uuid(),
  profileIds: profileIdsSchema,
});

// Add an applied job to the leads pipeline. Same payload shape as
// mark-applied — each lead wraps one (job, profile) pair.
export const addToLeadsSchema = markAppliedSchema;

// Whether a "YYYY-MM-DD" string is a REAL calendar date. The format regex
// alone admits impossible dates (Feb 31, month 13), which new Date() would
// silently roll over (Feb 31 → Mar 2) or throw on (month 13 → RangeError in
// the route's toISOString()). Reconstructing via Date.UTC and comparing the
// components catches both — and gets leap years right (Feb 29 only in leap
// years).
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Manually add a job from the Pipeline page's "New Job" flow. Creates the
// job (visible as a suggestion to every other profile), an applied/dismissed
// state row for the chosen profile, and — when state is "lead" — a lead row
// with a pipeline stage and the lead comment. date is the applied-on date
// (required for every job).
export const createManualJobSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(300),
    company: z.string().trim().min(1, "Company is required.").max(200),
    location: optionalTrimmedText,
    url: optionalTrimmedText,
    // Applied-on date ("YYYY-MM-DD"), required for every manual job.
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
      .refine(isRealCalendarDate, { message: "Enter a valid date." }),
    // Free-text source (e.g. LinkedIn, referral, email) — kept on
    // jobs.parsed_data; jobs.scraper_id points at the Manual scraper.
    source: optionalTrimmedText,
    // How the job reached us. Optional everywhere — an unset value stays null
    // (unclassified), which is also where every scraped job sits.
    engagementType: engagementTypeSchema,
    skills: z.array(z.string().trim().min(1)).max(100).optional(),
    budget: optionalTrimmedText,
    expCompensation: optionalTrimmedText,
    developer: optionalTrimmedText,
    profileId: z.uuid("Select a profile."),
    // Which state the chosen profile gets: applied (Pipeline feed), lead
    // (Pipeline + Leads with a stage), or dismissed. Everyone else's state
    // row stays suggested.
    state: z.enum(["applied", "lead", "dismissed"]),
    // Lead stage — comes from pipeline_stages; required when state is lead.
    pipelineStageId: z.uuid("Select a stage.").optional(),
    comment: optionalTrimmedText,
  })
  .refine((data) => data.state !== "lead" || data.pipelineStageId !== undefined, {
    message: "Select a stage for the lead.",
    path: ["pipelineStageId"],
  });

// Editing a scraped or manual job. Exactly the columns the discovery cron
// rewrites — and so exactly the ones jobs.manual_overrides can protect (the
// jobs_manual_overrides_known_columns check constraint, migration
// 20260812130222). Keep these two lists in step: a column added here without
// the constraint knowing it will fail the write.
export const JOB_EDITABLE_FIELDS = [
  "title",
  "companyName",
  "companyLocation",
  "description",
  "applyUrl",
  "isRemote",
  "jobPostedAt",
] as const;

export type JobEditableField = (typeof JOB_EDITABLE_FIELDS)[number];

/** camelCase payload key → the jobs column it writes (and protects). */
export const JOB_FIELD_COLUMNS: Record<JobEditableField, string> = {
  title: "title",
  companyName: "company_name",
  companyLocation: "company_location",
  description: "description",
  applyUrl: "apply_url",
  isRemote: "is_remote",
  jobPostedAt: "job_posted_at",
};

export const updateJobSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(300).optional(),
    companyName: z.string().trim().min(1, "Company is required.").max(200).optional(),
    // Nullable: clearing an optional field is a real edit, and still counts
    // as an override so the cron won't refill it.
    companyLocation: z.string().trim().max(300).nullable().optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    applyUrl: z.string().trim().max(2000).nullable().optional(),
    isRemote: z.boolean().nullable().optional(),
    jobPostedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
      .refine(isRealCalendarDate, { message: "Enter a valid date." })
      .nullable()
      .optional(),
    // Parsed-data extras — the structured fields on jobs.parsed_data (jsonb):
    // skills, technologies, experience, compensation, budget, source.
    // Edited by the same job editor as the columns above.
    skills: z.array(z.string().trim().min(1)).max(100).optional(),
    technologies: z.array(z.string().trim().min(1)).max(100).optional(),
    minExperience: z.number().nullable().optional(),
    expCompensation: z.string().trim().max(300).nullable().optional(),
    budget: z.string().trim().max(300).nullable().optional(),
    source: z.string().trim().max(300).nullable().optional(),
  })
  .refine(
    (data) =>
      [...JOB_EDITABLE_FIELDS, ...JOB_PARSED_DATA_FIELDS].some(
        (field) => data[field] !== undefined,
      ),
    { message: "Provide at least one field to update." },
  );

// The structured extras stored inside jobs.parsed_data (jsonb) rather than
// as columns. They're merged at write time and never join manual_overrides
// — its check constraint only knows the ingest-written columns (migration
// 20260812130222), and parsed_data is only ever written by the one-shot AI
// enrichment, never the nightly upsert, so an edit survives by construction.
// Developer is deliberately NOT here: it belongs to the lead, not the job
// (a job can have many leads, one per applying profile) — see migration
// 20260818090000 and leads.developer.
export const JOB_PARSED_DATA_FIELDS = [
  "skills",
  "technologies",
  "minExperience",
  "expCompensation",
  "budget",
  "source",
] as const;

export type JobParsedDataField = (typeof JOB_PARSED_DATA_FIELDS)[number];

/** camelCase payload key → the jobs.parsed_data key it writes. */
export const JOB_PARSED_DATA_KEYS: Record<JobParsedDataField, string> = {
  skills: "skills",
  technologies: "technologies",
  minExperience: "experienceYears",
  expCompensation: "salaryRange",
  budget: "budget",
  source: "source",
};

export const updateLeadSchema = z
  .object({
    notes: z.string().max(2000, "Notes must be 2000 characters or fewer.").optional(),
    pipelineStageId: z.uuid("Invalid stage.").optional(),
    // Who handles the lead. Lead-specific (a job can have many leads, one
    // per applying profile) — empty string clears it; absent means leave alone.
    developer: z
      .string()
      .trim()
      .max(300)
      .transform((value) => (value ? value : null))
      .optional(),
  })
  .refine(
    (data) =>
      data.notes !== undefined ||
      data.pipelineStageId !== undefined ||
      data.developer !== undefined,
    { message: "Provide notes, a stage, or a developer to update." },
  );

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(2000, "Comment must be 2000 characters or fewer."),
});

export const updateCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(2000, "Comment must be 2000 characters or fewer."),
});
