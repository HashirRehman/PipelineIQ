// Module 1 — session cookie refresh (Supabase SSR pattern)
import { createServerClient } from "@supabase/ssr";
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
  // trusting a possibly-stale cookie, unlike getSession(). Deactivation
  // (users.is_active) is enforced downstream in getCachedUser() — see
  // lib/supabase/server.ts — since this check now only runs for dashboard
  // page requests, not every request; getCachedUser() runs in every
  // dashboard layout/page render and every API route regardless.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
