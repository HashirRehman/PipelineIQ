import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PipelineIQLogo } from "@/components/pipelineiq-logo"
import { LoginForm } from "./login-form"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  const { error, message } = await searchParams

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
            <h1 className="font-heading text-base font-semibold tracking-tight text-foreground">Sign in to your account</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your email and password to continue.
            </p>
          </div>

          {/* message/error arrive ALREADY URL-decoded (Next.js decodes
              searchParams once) — decoding again would throw URIError on any
              value containing a literal % and 500 the page. React escapes the
              text, so there's no injection risk in rendering it as-is. */}
          {message && !error && (
            <div className="mb-4 rounded-md bg-success border border-success-foreground/20 px-3 py-2">
              <p className="text-xs text-success-foreground">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          PipelineIQ · Recurso Labs
        </p>
      </div>
    </div>
  )
}
