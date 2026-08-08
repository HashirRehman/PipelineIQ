import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PipelineIQLogo } from "@/components/pipelineiq-logo"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <PipelineIQLogo size="lg" />
        </div>

        {/* Card */}
        <div className="bg-background rounded-xl border border-border shadow-sm px-8 py-8">
          <div className="mb-6">
            <h1 className="text-base font-semibold text-foreground">Sign in to your account</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your email and password to continue.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{decodeURIComponent(error)}</p>
            </div>
          )}

          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          PipelineIQ &mdash; Recurso Labs
        </p>
      </div>
    </div>
  )
}
