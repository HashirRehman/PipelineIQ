import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/api/guard";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Server-side session establishment for email links (invite, recovery,
 * signup, magic link).
 *
 * The confirm page used to exchange the link's tokens in the browser via
 * createBrowserClient, which forced the session cookie to be JavaScript-
 * readable (httpOnly: false) and cached the auth object in localStorage.
 * Moving the exchange here lets every session cookie be HttpOnly (see
 * lib/supabase/cookie-options.ts) — the tokens never touch document.cookie
 * or localStorage.
 *
 * The page posts whatever Supabase put on the link (one of three shapes)
 * and this route turns it into a server-side session. Fails closed on any
 * invalid input.
 */
const confirmSchema = z.object({
  /** PKCE / server-side flow — `?code=…`. */
  code: z.string().min(1).optional(),
  /** Hashed-token flow — `?token_hash=…&type=invite`. */
  tokenHash: z.string().min(1).optional(),
  type: z.string().optional(),
  /** Implicit flow — tokens arrive in the URL fragment. */
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
  /** True when the page saw Supabase's own error_description/error params. */
  rejected: z.boolean().optional(),
});

/** The `type` values Supabase's /auth/v1/verify accepts on an emailed link. */
const OTP_TYPES: EmailOtpType[] = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email_change",
  "email",
];

function isOtpType(value: string | undefined | null): value is EmailOtpType {
  return value !== undefined && value !== null && (OTP_TYPES as string[]).includes(value);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "no_credentials" }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "no_credentials" }, { status: 400 });
  }

  const { code, tokenHash, type, accessToken, refreshToken, rejected } = parsed.data;

  // Supabase already rejected the link before the page ever loaded.
  if (rejected) {
    return NextResponse.json({ error: "link_rejected" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. PKCE / server-side flow.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return exchangeError(error.message);
    return NextResponse.json({ success: true });
  }

  // 2. Hashed-token flow (?token_hash=…&type=invite).
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: isOtpType(type) ? type : "invite",
    });
    if (error) return exchangeError(error.message);
    return NextResponse.json({ success: true });
  }

  // 3. Implicit flow — tokens in the URL fragment.
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return exchangeError(error.message);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "no_credentials" }, { status: 400 });
}

function exchangeError(message: string) {
  // Don't echo Supabase's internal error text to the page — a rejected
  // token (expired, already used, malformed) all surface as one message.
  console.error("api/auth/confirm: exchange failed:", message);
  return NextResponse.json({ error: "exchange_failed" }, { status: 400 });
}
