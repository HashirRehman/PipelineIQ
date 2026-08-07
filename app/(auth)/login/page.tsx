import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PipelineIQLogo } from "@/components/pipelineiq-logo";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 py-12 text-[var(--fg)]">
      <div className="w-full max-w-4xl">
        <div className="flex justify-center">
          <PipelineIQLogo size="lg" />
        </div>

        <div className="mt-12 grid items-center gap-12 md:grid-cols-2 md:gap-16">
          {/* Brand panel */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/lead-gen.png"
              alt=""
              width={539}
              height={428}
              priority
              className="h-auto w-full max-w-[280px]"
            />
            <h1 className="mt-8 font-heading text-2xl font-bold tracking-tight uppercase">
              Automate Lead Gen
            </h1>
            <p className="mt-3 max-w-xs text-sm text-[var(--muted-fg)]">
              PipelineIQ helps you automate candidate profiles, job discovery,
              and lead tracking — end to end.
            </p>
          </div>

          {/* Login panel */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl sm:p-8">
            {error === "auth_link_invalid" && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>
                  Your link has expired or already been used. Request a new
                  invite or password reset.
                </AlertDescription>
              </Alert>
            )}
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
