import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PipelineIQLogo } from "@/components/pipelineiq-logo"
import { organizationName } from "@/lib/constants"
import { ForgotPasswordForm } from "./forgot-password-form"

export default async function ForgotPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <PipelineIQLogo size="lg" />
        </div>

        {/* Card */}
        <div className="bg-background rounded-xl border border-border shadow-sm px-8 py-8">
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          PipelineIQ &mdash; {organizationName}
        </p>
      </div>
    </div>
  )
}
