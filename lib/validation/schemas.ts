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
