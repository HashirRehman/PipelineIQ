"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PipelineIQLogo } from "@/components/pipelineiq-logo";

/** Types Supabase's `/auth/v1/verify` can hand us on an emailed link. */
const OTP_TYPES: EmailOtpType[] = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as string[]).includes(value);
}

/**
 * Catches the link from an invite (or recovery) email and turns it into a
 * session, then hands off to /set-password.
 *
 * Supabase emits one of three link shapes depending on the project's email
 * template and flow type, so all three are handled — otherwise a template
 * change silently breaks the whole invite flow. Errors render in place rather
 * than redirecting to /login: bouncing to the login page is precisely what
 * made this hard to diagnose.
 */
export default function ConfirmAuthPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);

    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hash = new URLSearchParams(rawHash);

    // Supabase reports a rejected or expired link in either place.
    const linkError =
      query.get("error_description") ??
      query.get("error") ??
      hash.get("error_description") ??
      hash.get("error");

    const code = query.get("code");
    const tokenHash = query.get("token_hash") ?? query.get("token");
    const type = query.get("type");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    const supabase = createClient();

    const establishSession = async () => {
      // Supabase already rejected the link before we got here.
      if (linkError) {
        console.error("[confirm] link rejected by Supabase:", linkError);
        return new Error("link_rejected");
      }

      // 1. PKCE / server-side flow.
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        return exchangeError;
      }

      // 2. Hashed-token flow (?token_hash=…&type=invite).
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: isOtpType(type) ? type : "invite",
        });
        return verifyError;
      }

      // 3. Implicit flow — tokens arrive in the URL fragment.
      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        return setSessionError;
      }

      return new Error("no_credentials");
    };

    establishSession()
      .then((sessionError) => {
        if (!sessionError) {
          router.replace("/set-password");
          return;
        }

        if (sessionError.message === "link_rejected") {
          setError(
            "Your invite link is no longer valid. Ask an admin to send a new one.",
          );
          return;
        }

        if (sessionError.message === "no_credentials") {
          setError(
            "This link is missing its confirmation token. Open the link from your invite email directly, without copying only part of it.",
          );
          return;
        }

        console.error("[confirm] could not establish a session:", sessionError);
        setError("Your invite link has expired or has already been used.");
      })
      .catch((caughtError) => {
        console.error("[confirm] session setup threw:", caughtError);
        setError("Something went wrong confirming your link. Please try again.");
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <PipelineIQLogo size="lg" />
        </div>

        <div className="bg-background rounded-xl border border-border shadow-sm px-8 py-8">
          {error ? (
            <>
              <div className="mb-6">
                <h1 className="text-base font-semibold text-foreground">
                  Link didn&apos;t work
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  We couldn&apos;t confirm your invite.
                </p>
              </div>
              <p
                role="alert"
                className="text-xs text-destructive rounded-md bg-destructive/10 px-3 py-2"
              >
                {error}
              </p>
              <Link
                href="/login"
                className="mt-4 block text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Confirming your link…</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          PipelineIQ &mdash; Recurso Labs
        </p>
      </div>
    </div>
  );
}
