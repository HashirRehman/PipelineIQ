import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Full name is required."),
  email: z.email("Enter a valid email address."),
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

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

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

export const updateProfileSchema = profileCoreFieldsSchema.extend({
  profileId: z.uuid(),
});

export const setProfileActiveSchema = z.object({
  profileId: z.uuid(),
  isActive: z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform((value) => value === "true"),
  ]),
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

export const updateLeadSchema = z
  .object({
    notes: z.string().max(2000, "Notes must be 2000 characters or fewer.").optional(),
    pipelineStageId: z.uuid("Invalid stage.").optional(),
  })
  .refine(
    (data) => data.notes !== undefined || data.pipelineStageId !== undefined,
    { message: "Provide notes or a stage to update." },
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
