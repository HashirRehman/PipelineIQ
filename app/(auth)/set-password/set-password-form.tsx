"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { apiPost } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SetPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      const formData = new FormData(event.currentTarget)
      await apiPost<{ success: boolean }>("/api/auth/set-password", {
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
      })
      window.location.href = "/login"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Min. 8 characters"
          className="h-10 bg-muted/40 border-border text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
          Confirm password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          placeholder="Repeat password"
          className="h-10 bg-muted/40 border-border text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive rounded-md bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="mt-1 h-10 w-full text-sm font-semibold">
        {isPending ? (
          <><Loader2 className="size-4 animate-spin mr-2" />Setting password…</>
        ) : (
          "Set password"
        )}
      </Button>
    </form>
  )
}
