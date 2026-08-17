import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PipelineIQLogo } from "@/components/pipelineiq-logo"
import { SetPasswordForm } from "./set-password-form"

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>
}) {
  const { flow } = await searchParams
  // Set by /auth/confirm when it came from a password-reset email, so the copy
  // here doesn't send a locked-out user to an admin who can't help them.
  const isRecovery = flow === "recovery"

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // No session means the link was never confirmed (or has expired) — say so on
  // the login page instead of dumping the user there silently.
  if (!user) {
    redirect(
      `/login?error=${encodeURIComponent(
        isRecovery
          ? "Your reset link has expired or has already been used. Request a new one."
          : "Your invite link has expired or has already been used. Ask an admin to send a new one.",
      )}`,
    )
  }

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <PipelineIQLogo size="lg" />
        </div>
        <div className="bg-background rounded-xl border border-border shadow-sm px-8 py-8">
          <div className="mb-6">
            <h1 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {isRecovery ? "Choose a new password" : "Set your password"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isRecovery
                ? "Pick a secure password you haven't used here before."
                : "Choose a secure password to finish setting up your account."}
            </p>
          </div>
          <SetPasswordForm isRecovery={isRecovery} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          PipelineIQ · Recurso Labs
        </p>
      </div>
    </div>
  )
}
