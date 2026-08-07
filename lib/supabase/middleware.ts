// Module 1 — session cookie refresh (Supabase SSR pattern)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
  // trusting a possibly-stale cookie, unlike getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Enforce deactivation on live sessions. users.is_active is checked at
  // login (app/api/auth/login) — this closes the gap where an account
  // deactivated by an admin keeps a still-valid session until token expiry.
  // We read the row on every authenticated request; unauthenticated requests
  // short-circuit above and pay nothing. Mirrors the login gate exactly
  // (a row that exists but is flagged inactive blocks; a missing row does
  // not, so an invited user whose users row isn't inserted yet isn't locked
  // out of the confirm flow).
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (userRow && !userRow.is_active) {
      // Best-effort signOut so the stale cookie is cleared, then report
      // no user so the proxy redirects to /login.
      await supabase.auth.signOut();
      return { response, user: null, supabase };
    }
  }

  return { response, user, supabase };
}
