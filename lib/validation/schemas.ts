// Zod schemas shared by forms and Server Actions, Modules 1-4
import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.email("Enter a valid email address."),
  fullName: z.string().trim().min(1, "Full name is required."),
  roleId: z.uuid("Select a role."),
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
