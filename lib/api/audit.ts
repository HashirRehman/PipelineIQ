import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { clientIp } from "@/lib/api/rate-limit";

/**
 * Security audit logging (table introduced by the old
 * 20260812010000_audit_logs.sql migration, now folded into the consolidated
 * schema — see supabase/migrations/20260823200000_consolidated_schema.sql).
 *
 * Records who did what for team-management events: logins, password sets,
 * invites, member status/role changes, member deletion. Writes are
 * BEST-EFFORT — an audit failure is logged to the server console but never
 * fails the operation being recorded (a flaky audit write must not block a
 * login or a role change).
 *
 * FLAG: append-only / admin-only-read used to be enforced by RLS. RLS is now
 * disabled and, as of this writing, there is no Route Handler that reads
 * audit_logs back out and no code path that updates or deletes a row — the
 * table is currently write-only from the app's perspective, so the old
 * guarantee has no code-level replacement yet. If a read endpoint is ever
 * added, it MUST check perms.isAdmin (see lib/auth/roles.ts) before
 * returning rows, and no route should ever update/delete a row here.
 */

export type AuditAction =
  | "login"
  | "password_set"
  | "invite_sent"
  | "user_updated"
  | "user_deleted";

export interface AuditLogParams {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  /** The acting user's id (the caller). */
  actorUserId: string;
  action: AuditAction;
  /** The member the action is about, when different from the actor.
   *  Must reference a user that still EXISTS at insert time — the column
   *  is an FK to users(id). For actions whose target is deleted first
   *  (e.g. user_deleted), pass null and capture identity via targetEmail
   *  / metadata instead. */
  targetUserId?: string | null;
  targetEmail?: string | null;
  /** Extra structured detail (e.g. role changes, status changes). */
  metadata?: Json;
  /** Source request — captures the client IP for the log. */
  request?: Request;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  const {
    supabase,
    organizationId,
    actorUserId,
    action,
    targetUserId,
    targetEmail,
    metadata,
    request,
  } = params;

  const { error } = await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    action,
    target_user_id: targetUserId ?? null,
    target_email: targetEmail ?? null,
    ip_address: request ? clientIp(request) : null,
    metadata: metadata ?? {},
  });

  if (error) {
    // Audit must never break the operation it records.
    console.error(`audit: failed to record ${action}`, error);
  }
}
