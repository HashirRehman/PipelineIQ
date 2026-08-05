"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signIn, type SignInState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = {};

const fieldClass =
  "h-11 rounded-lg border-[var(--border-strong)] bg-[var(--secondary)] px-3 text-sm dark:bg-[var(--secondary)]";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-xs text-[var(--muted-fg)]">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-xs text-[var(--muted-fg)]">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${fieldClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--muted-fg)] transition-colors hover:text-[var(--fg)]"
          >
            {showPassword ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs text-[var(--muted-fg)] transition-colors hover:text-[var(--primary)]"
        >
          Forgot password?
        </Link>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="mt-1 h-11 w-full rounded-lg text-sm font-semibold"
      >
        {isPending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
