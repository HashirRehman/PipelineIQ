"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, MailCheck } from "lucide-react"
import { apiPost } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      const formData = new FormData(event.currentTarget)
      const email = String(formData.get("email") ?? "")
      await apiPost<{ success: boolean }>("/api/auth/forgot-password", { email })
      setSentTo(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  // The API deliberately reports success for unknown addresses, so this panel
  // is careful not to confirm that an account exists.
  if (sentTo) {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-success">
            <MailCheck className="size-5 text-success-foreground" />
          </div>
          <h1 className="mt-4 text-base font-semibold text-foreground">Check your email</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            If an account exists for{" "}
            <span className="font-medium text-foreground">{sentTo}</span>, a password reset link is
            on its way. The link expires in one hour.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSentTo(null)}
            className="h-10 w-full text-sm font-semibold"
          >
            Use a different email
          </Button>
          <Link
            href="/login"
            className="text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-base font-semibold text-foreground">Reset your password</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Enter your email and we&apos;ll send you a link to choose a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="h-10 bg-muted/40 border-border text-sm"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="mt-1 h-10 w-full text-sm font-semibold"
        >
          {isPending ? (
            <><Loader2 className="size-4 animate-spin mr-2" />Sending link…</>
          ) : (
            "Send reset link"
          )}
        </Button>

        <Link
          href="/login"
          className="text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to sign in
        </Link>
      </form>
    </>
  )
}
