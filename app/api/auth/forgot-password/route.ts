import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
} from "@/lib/api/rate-limit";
import { resolveSiteUrl } from "@/lib/api/site-url";
import { forgotPasswordSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Deliberately NOT the shared server client from lib/supabase/server.
 *
 * That one runs the default `flowType: "pkce"`, and resetPasswordForEmail then
 * registers a code_challenge and stores the matching verifier in the *browser
 * that asked for the reset* (see GoTrueClient.resetPasswordForEmail). The
 * emailed link is only redeemable by that same browser — so opening it on a
 * phone, in another browser, or even on a different origin (localhost vs
 * 127.0.0.1) fails with AuthPKCECodeVerifierMissingError. Requesting a reset on
 * a laptop and opening the mail on a phone is completely ordinary, so PKCE
 * can't be used here.
 *
 * With the implicit flow no verifier exists: Supabase puts the tokens in the
 * link's fragment and /auth/confirm calls setSession, which works from any
 * device. persistSession is off because this call is stateless — it only asks
 * Supabase to send an email and must not touch the caller's cookies.
 */
function createRecoveryMailClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  // Per-IP burst cap on top of Supabase's own per-email rate limit: one IP
  // must not be able to trigger reset emails for many different addresses
  // (inbox bombing / email-provider abuse). Every request costs an email, so
  // the cap is tighter than the login one.
  const ipLimit = checkRateLimit(`forgot-password:ip:${clientIp(request)}`, 5, 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterMs);

  // The target must also be in the project's Auth redirect allow list, or
  // Supabase silently falls back to site_url and the link lands on /login.
  const siteUrl = resolveSiteUrl(request);
  if (!siteUrl) {
    // Fail closed: a reset link built from an unvalidated Host header could
    // point at an attacker's origin (password-reset poisoning). The 500 is
    // emitted for every request, so it leaks nothing about account existence.
    console.error("api/auth/forgot-password: NEXT_PUBLIC_SITE_URL is not set.");
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const supabase = createRecoveryMailClient();

  // flow=recovery is ours, not Supabase's: the `type` param doesn't reliably
  // survive the /auth/v1/verify -> redirect_to hop, and /auth/confirm needs to
  // know whether to speak invite or password-reset language.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?flow=recovery`,
  });

  if (error) {
    // Surface the rate limit — claiming "sent" when nothing was sent leaves
    // the user waiting on an email that will never arrive.
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return NextResponse.json(
        { error: "Too many reset requests. Wait a few minutes and try again." },
        { status: 429 },
      );
    }
    // Anything else is reported as success on purpose: a distinguishable
    // response here would turn this route into an account-enumeration oracle.
    console.error("api/auth/forgot-password: resetPasswordForEmail failed", error);
  }

  return NextResponse.json({ success: true });
}
