// Zod schemas shared by forms and Server Actions, Modules 1-4
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

// Optional numeric form fields arrive as strings ("" when left blank), so an
// empty string must become undefined ("not provided"), not 0.
const optionalNonNegativeNumber = z
  .string()
  .optional()
  .transform((value) => (value ? Number(value) : undefined))
  .refine((value) => value === undefined || value >= 0, "Must be zero or greater.");

const optionalTrimmedText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

export const engineerCoreFieldsSchema = z.object({
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
    .optional()
    .transform((value) => (value ? value.toUpperCase() : "USD"))
    .refine((value) => value.length === 3, "Currency must be a 3-letter code."),
  summary: optionalTrimmedText,
});

export const createEngineerSchema = engineerCoreFieldsSchema;

export const updateEngineerSchema = engineerCoreFieldsSchema.extend({
  engineerId: z.uuid(),
});

export const setEngineerActiveSchema = z.object({
  engineerId: z.uuid(),
  // z.coerce.boolean() would treat the literal string "false" as truthy —
  // an explicit enum is what makes deactivation actually work.
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const engineerBdAssignmentSchema = z.object({
  engineerId: z.uuid(),
  bdUserId: z.uuid("Select a BD Executive."),
});

export const uploadEngineerCvSchema = z.object({
  engineerId: z.uuid(),
  label: z.string().trim().min(1, "Label is required."),
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, "Select a file to upload."),
});

export const dismissJobSchema = z.object({
  jobId: z.uuid(),
  profileId: z.uuid(),
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

export const markAppliedSchema = z.object({
  jobId: z.uuid(),
  profileId: z.uuid(),
});

