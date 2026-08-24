"use client"

import { useMemo, useState } from "react"
import { Eye, EyeOff, Loader2, Check } from "lucide-react"
import { apiPost } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_REQUIREMENTS } from "@/lib/validation/schemas"
import { cn } from "@/lib/utils"

/** `isRecovery` only swaps wording — the password update path is identical. */
export function SetPasswordForm({ isRecovery = false }: { isRecovery?: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const checks = useMemo(() => ({
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    hasLetterAndNumber:
      PASSWORD_REQUIREMENTS.hasLetter(password) && PASSWORD_REQUIREMENTS.hasNumber(password),
    hasSymbol: PASSWORD_REQUIREMENTS.hasSymbol(password),
    matches: password.length > 0 && password === confirmPassword,
  }), [password, confirmPassword])

  const meetsRequirements = checks.minLength && checks.hasLetterAndNumber && checks.hasSymbol
  const canSubmit = meetsRequirements && checks.matches

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!meetsRequirements) {
      setError("Password does not meet all requirements.")
      return
    }

    if (!checks.matches) {
      setError("Passwords do not match.")
      return
    }

    setIsPending(true)
    try {
      await apiPost<{ success: boolean }>("/api/auth/set-password", {
        password,
        confirmPassword,
      })
      // The session survives the password change (see the route), so drop the
      // user straight onto the dashboard — no re-login. A full page load also
      // guarantees the fresh session cookies are used to fetch the dashboard.
      window.location.href = "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
          New password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Min. 8 characters"
            className="h-10 bg-muted/40 border-border text-sm pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
          Confirm password
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Repeat password"
            className="h-10 bg-muted/40 border-border text-sm pr-10"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirmPassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
        {confirmPassword.length > 0 && !checks.matches && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
      </div>

      <ul className="space-y-1.5">
        {[
          { label: "At least 8 characters long", met: checks.minLength },
          { label: "Mix of letters and numbers", met: checks.hasLetterAndNumber },
          { label: "At least one symbol", met: checks.hasSymbol },
        ].map((req) => (
          <li
            key={req.label}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              req.met ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Check className={cn("size-3.5 shrink-0", req.met ? "text-status-emerald" : "text-muted-foreground/60")} />
            {req.label}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-xs text-destructive rounded-md bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending || !canSubmit} className="mt-1 h-10 w-full text-sm font-semibold">
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            {isRecovery ? "Updating password…" : "Setting password…"}
          </>
        ) : isRecovery ? (
          "Update password"
        ) : (
          "Set password"
        )}
      </Button>
    </form>
  )
}
