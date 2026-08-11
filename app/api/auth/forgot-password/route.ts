import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
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

  // Same fallback as the invite flow in app/api/users: an unset
  // NEXT_PUBLIC_SITE_URL would otherwise mail out "undefined/auth/confirm".
  // The target must also be in the project's Auth redirect allow list, or
  // Supabase silently falls back to site_url and the link lands on /login.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    new URL(request.url).origin;

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
