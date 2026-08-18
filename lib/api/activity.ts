import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { clientIp } from "@/lib/api/rate-limit";

/**
 * Business activity feed (see supabase/migrations/20260813075322_user_activities.sql).
 *
 * Records BUSINESS actions — profiles, jobs, leads, comments, discovery,
 * and team management (invites, member edits, member removal) — as a
 * human-readable feed. Overlaps lib/api/audit.ts (login / password_set /
 * invite_sent / user_updated / user_deleted), which stays the Admin-only
 * security trail with richer metadata; this feed is visible to Admin + BD
 * Manager org-wide, and to every other role for their own actions.
 *
 * Writes are BEST-EFFORT and go out AFTER the mutation they describe has
 * already succeeded — an activity-log failure must never fail, retry, or
 * roll back the operation it records, and a logged action must always have
 * actually happened. Call this last in a route, once every prior return
 * has already happened.
 */

export type ActivityAction =
  | "profile_created"
  | "profile_updated"
  | "profile_assigned"
  | "profile_unassigned"
  | "profile_archived"
  | "profile_cv_uploaded"
  | "profile_cv_deleted"
  | "profile_cv_parsed"
  | "job_created"
  | "job_updated"
  | "job_imported"
  | "job_comment_posted"
  | "job_comment_updated"
  | "job_comment_deleted"
  | "lead_created"
  | "lead_stage_updated"
  | "lead_notes_updated"
  | "discovery_dismissed"
  | "discovery_mark_applied"
  | "discovery_run_triggered"
  | "user_invited"
  | "user_updated"
  | "user_deleted";

/** Every value of ActivityAction, for validating the ?action= filter and
 *  building the UI's filter dropdown without a second hardcoded list. */
export const ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  "profile_created",
  "profile_updated",
  "profile_assigned",
  "profile_unassigned",
  "profile_archived",
  "profile_cv_uploaded",
  "profile_cv_deleted",
  "profile_cv_parsed",
  "job_created",
  "job_updated",
  "job_imported",
  "job_comment_posted",
  "job_comment_updated",
  "job_comment_deleted",
  "lead_created",
  "lead_stage_updated",
  "lead_notes_updated",
  "discovery_dismissed",
  "discovery_mark_applied",
  "discovery_run_triggered",
  "user_invited",
  "user_updated",
  "user_deleted",
];

export interface LogActivityParams {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  /** The acting user's id — becomes user_id, and RLS requires it match
   *  auth.uid() (a caller can only ever log their OWN activity). */
  actorUserId: string;
  /** Snapshot of the acting user's display name (RLS scopes by id, not this
   *  — this is purely so the feed still reads right if the user is later
   *  renamed or removed). */
  actorName: string;
  action: ActivityAction;
  /** Rendered, human-readable sentence for the feed, e.g.
   *  'Uploaded CV "jane-doe.pdf" to profile "Jane Doe"'. A snapshot, same
   *  reasoning as entityLabel below — write it once, don't derive it later. */
  description: string;
  /** What the action was about (no FK — the subject may be deleted later
   *  and the row must survive that). */
  entityType?: "profile" | "job" | "lead" | "profile_cv" | "job_comment" | "user" | null;
  entityId?: string | null;
  /** Snapshot of the subject's name/title at the time. */
  entityLabel?: string | null;
  /** Extra structured detail for a future detail view; not used for the
   *  rendered description. */
  metadata?: Json;
  /** Source request — captures the client IP for the log. */
  request?: Request;
}

/** Display name for the acting user, same fallback the dashboard shell uses
 *  (app/(dashboard)/layout.tsx): JWT full_name, then the email's local part,
 *  then "User". Avoids an extra `users` table round trip at every call site
 *  purely to log a name snapshot. */
export function actorNameFromUser(user: {
  user_metadata?: Record<string, unknown> | null;
  email?: string | null;
}): string {
  const metaName = user.user_metadata?.full_name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  return user.email?.split("@")[0] || "User";
}

/** Display label per action, for the feed's filter dropdown and rows. A
 *  Record<ActivityAction, string> so adding an action without a label here
 *  is a compile error, not a silent blank in the UI. */
export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  profile_created: "Profile created",
  profile_updated: "Profile updated",
  profile_assigned: "Profile assigned",
  profile_unassigned: "Profile unassigned",
  profile_archived: "Profile archived",
  profile_cv_uploaded: "CV uploaded",
  profile_cv_deleted: "CV deleted",
  profile_cv_parsed: "CV parsed",
  job_created: "Job added",
  job_updated: "Job edited",
  job_imported: "Jobs imported",
  job_comment_posted: "Comment posted",
  job_comment_updated: "Comment edited",
  job_comment_deleted: "Comment deleted",
  lead_created: "Lead created",
  lead_stage_updated: "Lead stage updated",
  lead_notes_updated: "Lead notes updated",
  discovery_dismissed: "Job dismissed",
  discovery_mark_applied: "Marked applied",
  discovery_run_triggered: "Discovery run",
  user_invited: "Member invited",
  user_updated: "Member updated",
  user_deleted: "Member removed",
};

export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    supabase,
    organizationId,
    actorUserId,
    actorName,
    action,
    description,
    entityType,
    entityId,
    entityLabel,
    metadata,
    request,
  } = params;

  const { error } = await supabase.from("user_activities").insert({
    organization_id: organizationId,
    user_id: actorUserId,
    actor_name: actorName,
    action,
    description,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    entity_label: entityLabel ?? null,
    metadata: metadata ?? {},
    ip_address: request ? clientIp(request) : null,
  });

  if (error) {
    // Activity logging must never break the operation it records.
    console.error(`activity: failed to record ${action}`, error);
  }
}
