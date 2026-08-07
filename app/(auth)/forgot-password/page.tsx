import Link from "next/link";
import { PipelineIQLogo } from "@/components/pipelineiq-logo";

/**
 * Accounts are Admin-invite-only (see CLAUDE.md) — there is no self-service
 * reset flow, so this page routes people to an administrator rather than
 * leaving the login screen's "Forgot password?" link dead.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 py-12 text-[var(--fg)]">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <PipelineIQLogo size="lg" />
        </div>

        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl sm:p-8">
          <h1 className="font-heading text-lg font-semibold">
            Forgot your password?
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-fg)]">
            PipelineIQ accounts are managed by an administrator. Ask an admin to
            send you a new invite link — it lets you set a fresh password.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-[var(--primary)] hover:underline"
          >
            ← Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
}
