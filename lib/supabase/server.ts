// Module 1 — server-side Supabase client, user-scoped (RLS-enforced)
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getRolePermissions,
  isAdminRole,
  isBdManagerRole,
  type RolePermissionSet,
} from "@/lib/auth/roles";
import { supabaseCookieOptions } from "./cookie-options";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // HttpOnly + SameSite=Lax + Secure-in-prod + bounded lifetime — see
      // lib/supabase/cookie-options.ts. Everything that establishes or
      // refreshes a session now runs server-side, so the tokens never need
      // to be JavaScript-readable.
      cookieOptions: supabaseCookieOptions,
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

// getUser() was getting called separately by (dashboard)/layout.tsx (for
// sidebar display) and again by whichever page it wraps — 2 real network
// round trips, every single navigation. React's cache() memoizes a call
// per server request, so layout + page share one real call instead of
// two. Middleware's own getUser() check (a separate Edge runtime
// execution, and the real session-revalidation boundary) is intentionally
// left untouched — it can't share this cache with the Node-side render
// anyway, and getUser() (vs. getSession()) revalidating against the Auth
// server rather than trusting a possibly-stale/revoked cookie is a
// deliberate existing security choice, not renegotiated here.
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// The display role name (e.g. "Admin", "User") baked into the JWT as the
// user_role claim by custom_access_token_hook. Read locally via cached JWKS
// (no per-call network request). Returns null when the claim is missing so
// callers can hide the label rather than guess.
export const getCachedUserRole = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const role = data?.claims?.user_role;
  return typeof role === "string" && role.length > 0 ? role : null;
});

export type RolePermissions = RolePermissionSet & {
  role: string | null;
  isAdmin: boolean;
  isBdManager: boolean;
};

// The acting user's permissions, derived once per server request from the
// JWT's user_role claim (same memoization as getCachedUserRole). The flag
// set comes from the ROLE_PERMISSIONS matrix in lib/auth/roles.ts — the
// single source of truth for what each role may do. RLS is the real
// boundary — these flags only gate which UI/API paths a role may take.
export const getCachedRolePermissions = cache(async (): Promise<RolePermissions> => {
  const role = await getCachedUserRole();
  return {
    role,
    isAdmin: isAdminRole(role),
    isBdManager: isBdManagerRole(role),
    ...getRolePermissions(role),
  };
});

// The acting user's organization id, resolved once per server request (same
// memoization as getCachedUser). The dashboard layout uses this to hand the
// org id down to the client, which forwards it on every API call. users
// rows are created at invite with a NOT NULL organization_id, so the row
// read is the whole lookup — the old by-name "Recurso Labs" fallback was
// unreachable and is gone (it would also pin a user to the wrong org in a
// multi-tenant deployment).
export const getCachedOrganizationId = cache(async () => {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return userRow?.organization_id ?? null;
});
