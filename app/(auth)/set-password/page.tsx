import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PipelineIQLogo } from "@/components/pipelineiq-logo"
import { SetPasswordForm } from "./set-password-form"

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <PipelineIQLogo size="lg" />
        </div>
        <div className="bg-background rounded-xl border border-border shadow-sm px-8 py-8">
          <div className="mb-6">
            <h1 className="text-base font-semibold text-foreground">Set your password</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Choose a secure password to finish setting up your account.
            </p>
          </div>
          <SetPasswordForm />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          PipelineIQ &mdash; Recurso Labs
        </p>
      </div>
    </div>
  )
}
