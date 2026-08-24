"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { RevXLogo } from "@/components/revx-logo";
import { organizationName } from "@/lib/constants";

/**
 * Catches the link from an invite (or recovery) email and turns it into a
 * session, then hands off to /set-password.
 *
 * Supabase emits one of three link shapes depending on the project's email
 * template and flow type, so all three are handled — otherwise a template
 * change silently breaks the whole invite flow. The tokens are handed to a
 * server route handler (/api/auth/confirm) that exchanges them server-side,
 * so the session cookie can be HttpOnly (no document.cookie reads, no
 * localStorage copies). Errors render in place rather than redirecting to
 * /login: bouncing to the login page is precisely what made this hard to
 * diagnose.
 *
 * `?flow=recovery` is set by us on the redirectTo we hand Supabase (see
 * app/api/auth/forgot-password) — Supabase's own `type` param doesn't survive
 * every link shape, and this page has to know whether to speak invite or
 * password-reset language.
 */
export default function ConfirmAuthPage() {
  const router = useRouter();
  // The flow only ever matters alongside a failure, so it rides along with the
  // message instead of being its own state (which would mean a synchronous
  // setState in the effect body).
  const [failure, setFailure] = useState<{
    message: string;
    isRecovery: boolean;
  } | null>(null);
  // StrictMode in dev mounts effects twice; the confirmation tokens are
  // single-use, so the second run would exchange an already-consumed code
  // and surface a spurious error before the redirect lands. Run once.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const query = new URLSearchParams(window.location.search);
    // `flow` is ours (set on redirectTo); `type` is Supabase's, present when the
    // email template links straight here with a token_hash. Either one means
    // this is a password reset, so the copy below doesn't talk about invites.
    const recovery =
      query.get("flow") === "recovery" || query.get("type") === "recovery";
    const fail = (message: string) => setFailure({ message, isRecovery: recovery });

    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hash = new URLSearchParams(rawHash);

    // Supabase reports a rejected or expired link in either place.
    const rejected =
      query.get("error_description") !== null ||
      query.get("error") !== null ||
      hash.get("error_description") !== null ||
      hash.get("error") !== null;

    const code = query.get("code");
    const tokenHash = query.get("token_hash") ?? query.get("token");
    const type = query.get("type");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    // Drop tokens/codes from the address bar on failure so they don't linger
    // in browser history or get re-submitted on a refresh. (Success already
    // clears them via the router.replace below.)
    const scrubUrl = () => {
      window.history.replaceState({}, "", window.location.pathname);
    };

    const establishSession = async () => {
      // Exchange server-side so the session cookie can be HttpOnly. The
      // route validates origin + shape and sets the cookies in its response.
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code ?? undefined,
          tokenHash: tokenHash ?? undefined,
          type: type ?? undefined,
          accessToken: accessToken ?? undefined,
          refreshToken: refreshToken ?? undefined,
          rejected: rejected || undefined,
        }),
        cache: "no-store",
      });

      let payload: { success?: boolean; error?: string };
      try {
        payload = (await res.json()) as typeof payload;
      } catch {
        throw new Error("bad_response");
      }

      if (res.ok && payload.success) return;
      return payload.error ?? "exchange_failed";
    };

    establishSession()
      .then((errorCode) => {
        if (!errorCode) {
          router.replace(recovery ? "/set-password?flow=recovery" : "/set-password");
          return;
        }

        scrubUrl();

        if (errorCode === "link_rejected") {
          fail(
            recovery
              ? "Your reset link is no longer valid. Request a new one below."
              : "Your invite link is no longer valid. Ask an admin to send a new one.",
          );
          return;
        }

        if (errorCode === "no_credentials") {
          fail(
            `This link is missing its confirmation token. Open the link from your ${
              recovery ? "reset" : "invite"
            } email directly, without copying only part of it.`,
          );
          return;
        }

        console.error("[confirm] could not establish a session:", errorCode);
        fail(
          recovery
            ? "Your reset link has expired or has already been used."
            : "Your invite link has expired or has already been used.",
        );
      })
      .catch((caughtError) => {
        scrubUrl();
        console.error("[confirm] session setup threw:", caughtError);
        fail("Something went wrong confirming your link. Please try again.");
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <RevXLogo size="lg" />
        </div>

        <div className="bg-background rounded-xl border border-border shadow-sm px-8 py-8">
          {failure ? (
            <>
              <div className="mb-6">
                <h1 className="text-base font-semibold text-foreground">
                  Link didn&apos;t work
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  {failure.isRecovery
                    ? "We couldn't confirm your password reset."
                    : "We couldn't confirm your invite."}
                </p>
              </div>
              <p
                role="alert"
                className="text-xs text-destructive rounded-md bg-destructive/10 px-3 py-2"
              >
                {failure.message}
              </p>
              {failure.isRecovery && (
                <Link
                  href="/forgot-password"
                  className="mt-4 block text-xs font-medium text-primary hover:underline"
                >
                  Request a new reset link
                </Link>
              )}
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
          RevX &mdash; {organizationName}
        </p>
      </div>
    </div>
  );
}
