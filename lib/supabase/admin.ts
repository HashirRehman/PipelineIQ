// Module 1 — service-role Supabase client
//
// RLS is disabled across the schema; access control is enforced in Route
// Handlers / lib/services before any query runs, not by Postgres. This client
// is used for Supabase admin-API calls (e.g. auth.admin.inviteUserByEmail),
// system-owned writes (e.g. CV parse columns), and all storage.objects
// reads/writes — the profile-cvs bucket is private with no client-facing
// policies, so the backend is the only thing that can reach it at all.
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Memoized: this client carries no session/cookies (persistSession: false),
// so it's identical on every call — safe to build once and reuse across
// requests instead of constructing a fresh client (and its internal fetch/
// storage/auth sub-clients) on every call site that needs it.
let cached: SupabaseClient<Database> | undefined;

export function createAdminClient() {
  cached ??= createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return cached;
}
