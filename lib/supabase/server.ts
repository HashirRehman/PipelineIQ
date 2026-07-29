// Module 1 — server-side Supabase client, user-scoped (RLS-enforced)
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, which can't set cookies.
            // Middleware refreshes the session on the next request instead.
          }
        },
      },
    },
  );
}

// Both getUser() and is_admin() were getting called separately by
// (dashboard)/layout.tsx (for sidebar display) and again by whichever page
// it wraps (for that page's own filtering/copy) — 2 real network round
// trips each, every single navigation. React's cache() memoizes a call per
// server request, so layout + page share one real call instead of two.
// Middleware's own getUser()/is_admin() checks (a separate Edge runtime
// execution, and the actual /admin/* access-control boundary per this
// project's RLS-first rule) are intentionally left untouched — they can't
// share this cache with the Node-side render anyway.
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCachedIsAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return !!data;
});
