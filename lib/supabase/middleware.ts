// Module 1 — session cookie refresh (Supabase SSR pattern)
import { createServerClient } from "@supabase/ssr";

/**
 * The acting user's id, decoded locally from the session's access-token JWT
 * (the `sub` claim, stable across token refreshes). Kept out of getSession()'s
 * `session.user`, which is wrapped in a warning proxy on the server; the
 * access_token itself is plain data. Returns null when the token can't be
 * parsed, which simply skips the deactivation check below.
 */
function userIdFromAccessToken(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64));
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCookieOptions } from "./cookie-options";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // HttpOnly + SameSite=Lax + Secure-in-prod + bounded lifetime — see
      // lib/supabase/cookie-options.ts. Refresh happens here in the
      // middleware (server-side), so the tokens never need to be readable
      // from JavaScript.
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the token against the Auth server rather than
  // trusting a possibly-stale cookie, unlike getSession(). The deactivation
  // read below is keyed on the acting user's id — decoded locally from the
  // session's access-token JWT — so BOTH network checks run concurrently
  // instead of serially: the same two security checks at roughly half the
  // wall-clock TTFB. (getSession() is a local cookie decode here; it only
  // refreshes when the access token is near expiry, which getUser() would
  // refresh anyway, and its refresh is single-flighted inside auth-js.)
  const deactivationCheck = supabase.auth
    .getSession()
    .then(({ data }) => data.session?.access_token ?? null)
    .then(async (accessToken) => {
      const userId = accessToken ? userIdFromAccessToken(accessToken) : null;
      if (!userId) return { data: null };
      const { data } = await supabase
        .from("users")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle();
      return { data };
    });

  const [{ data: { user } }, { data: userRow }] = await Promise.all([
    supabase.auth.getUser(),
    deactivationCheck,
  ]);

  // Enforce deactivation on live sessions. users.is_active is checked at
  // login (app/api/auth/login) — this closes the gap where an account
  // deactivated by an admin keeps a still-valid session until token expiry.
  // Mirrors the login gate exactly (a row that exists but is flagged
  // inactive blocks; a missing row does not, so an invited user whose users
  // row isn't inserted yet isn't locked out of the confirm flow). The
  // deactivation read is gated on getUser()'s verdict — a revoked session
  // reports no user and the row check is ignored.
  if (user) {
    if (userRow && !userRow.is_active) {
      // Best-effort signOut so the stale cookie is cleared, then report
      // no user so the proxy redirects to /login.
      await supabase.auth.signOut();
      return { response, user: null, supabase };
    }
  }

  return { response, user, supabase };
}
