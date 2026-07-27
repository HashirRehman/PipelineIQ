// Module 1 — service-role Supabase client, cron/admin-only
//
// Only for calls that require Supabase's admin API (e.g. auth.admin.inviteUserByEmail).
// Never use this client for table reads/writes — those go through
// lib/supabase/server.ts so RLS stays the access-control boundary.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
