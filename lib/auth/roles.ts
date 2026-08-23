// ===========================================================================
// Role permissions — SINGLE SOURCE OF TRUTH.
//
// Every role's permissions are defined once, in ROLE_PERMISSIONS below. To
// add a new role, or change what a role may do, edit this matrix — nothing
// else should hardcode role names or permission logic.
//
// Consumers:
//   * Server code            — getCachedRolePermissions() in
//                              lib/supabase/server.ts derives the per-request
//                              permission object from this matrix.
//   * Client components      — getRolePermissionsByKey() (the dashboard
//                              layout passes the role lowercased, so lookup
//                              is case-insensitive).
//   * API routes             — read flags off RolePermissions (e.g.
//                              perms.canModerateComments), never role names.
//
// Role names come from the DB `roles` table; the JWT's `user_role` claim
// (baked by custom_access_token_hook) carries the same name, so app-layer
// checks read the claim and RLS re-checks against the live table.
//
// DATABASE BOUNDARY — keep RLS in sync: this matrix only gates the app layer
// (pages, nav, API paths). Row-level security in supabase/migrations is the
// real access boundary and must be widened for any new role/permission here
// (e.g. migration 15 admits is_bd_manager() on every business table; user
// management stays admin-only even at the DB level). A role added to this
// matrix without the matching RLS policies will pass the app gates but see
// no data.
// ===========================================================================

export type RoleName = "Admin" | "BD Manager" | "Business Developer";

/** What a role may do. Add a flag here, set it for every role in
 * ROLE_PERMISSIONS, then consume it via RolePermissions (server) or
 * getRolePermissionsByKey (client). */
export type RolePermissionSet = {
  /** Display label (sidebar / top bar). */
  label: string;
  /** Users page (team roster) visibility. */
  canViewUsers: boolean;
  /** Editing / deactivating / deleting OTHER team members. Everyone may edit
   * their own name (self-edit carve-out in the users API + RLS). */
  canManageUsers: boolean;
  /** Inviting team members. */
  canInviteUsers: boolean;
  /** Profiles page — view + manage candidate profiles (create / edit /
   * assign / upload / parse CVs). */
  canAccessProfiles: boolean;
  /** Job pages — Discovery / Pipeline / Leads / Statistics. */
  canAccessJobs: boolean;
  /** Editing a job's own fields (title, company, description…). Mirrors the
   * jobs_update RLS policy (migration 20260812130222: is_admin() or
   * is_bd_manager()) — Business Developers may create a job but not edit one. */
  canEditJobs: boolean;
  /** Content moderation — delete other users' comments. */
  canModerateComments: boolean;
  /** Pipeline management — edit other users' lead notes. */
  canManageLeadNotes: boolean;
  /** Lead Stages page — create / edit / reorder / delete pipeline_stages.
   * Admin-only; mirrors the pipeline_stages_insert/update/delete RLS
   * policies (migration 20260823085325), which also gate is_admin() only. */
  canManageLeadStages: boolean;
  /** Landing section for this role. The root page ("/") renders the
   *  Dashboard for every role (Statistics lives at /statistics), so this is
   *  "/" across the board — kept on the matrix so a per-role landing can
   *  be reintroduced as a one-line change. */
  homeSection: string;
  /** App-facing role key used for UI colors / filters ("admin" | "lead" | "bd"). */
  userRoleKey: "admin" | "lead" | "bd";
};

export const ROLE_PERMISSIONS: Record<RoleName, RolePermissionSet> = {
  Admin: {
    label: "Admin",
    canViewUsers: true,
    canManageUsers: true,
    canInviteUsers: true,
    canAccessProfiles: true,
    canAccessJobs: true,
    canEditJobs: true,
    canModerateComments: true,
    canManageLeadNotes: true,
    canManageLeadStages: true,
    homeSection: "/",
    userRoleKey: "admin",
  },
  "BD Manager": {
    label: "BD Manager",
    canViewUsers: true,
    // Everything Admin has EXCEPT user management: full Profiles / job pages
    // / moderation — but only their own user row (name) may be edited, and
    // invites are out.
    canManageUsers: false,
    canInviteUsers: false,
    canAccessProfiles: true,
    canAccessJobs: true,
    canEditJobs: true,
    canModerateComments: true,
    canManageLeadNotes: true,
    canManageLeadStages: false,
    homeSection: "/",
    userRoleKey: "lead",
  },
  "Business Developer": {
    label: "Business Developer",
    canViewUsers: false,
    canManageUsers: false,
    canInviteUsers: false,
    canAccessProfiles: false,
    canAccessJobs: true,
    canEditJobs: false,
    canModerateComments: false,
    canManageLeadNotes: false,
    canManageLeadStages: false,
    homeSection: "/",
    userRoleKey: "bd",
  },
};

/** Permissions for an exact role name. Unknown / missing roles fall back to
 * the lowest-privilege usable set (Business Developer) so a session whose
 * role row hasn't been assigned yet can still use the job pages — same
 * behavior as the old hardcoded helpers. */
export function getRolePermissions(
  role: string | null | undefined,
): RolePermissionSet {
  if (role && role in ROLE_PERMISSIONS) {
    return ROLE_PERMISSIONS[role as RoleName];
  }
  return ROLE_PERMISSIONS["Business Developer"];
}

// Client components receive the role lowercased from the dashboard layout,
// so look it up case-insensitively (built once, not per call).
const ROLE_PERMISSIONS_BY_KEY: Record<string, RolePermissionSet> =
  Object.fromEntries(
    (Object.keys(ROLE_PERMISSIONS) as RoleName[]).map((name) => [
      name.toLowerCase(),
      ROLE_PERMISSIONS[name],
    ]),
  );

/** Permissions for a role key as sent to client components (lowercased
 * names, e.g. "admin", "bd manager", "business developer"). */
export function getRolePermissionsByKey(
  role: string | null | undefined,
): RolePermissionSet {
  if (role) {
    const perms = ROLE_PERMISSIONS_BY_KEY[role.toLowerCase()];
    if (perms) return perms;
  }
  return ROLE_PERMISSIONS["Business Developer"];
}

// ---------------------------------------------------------------------------
// Derived helpers — kept so existing callers keep working; every one reads
// the matrix above, never its own role logic.
// ---------------------------------------------------------------------------
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "Admin";
}

export function isBdManagerRole(role: string | null | undefined): boolean {
  return role === "BD Manager";
}

export function canViewUsersRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canViewUsers;
}

export function canManageUsersRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canManageUsers;
}

export function canInviteUsersRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canInviteUsers;
}

export function canAccessProfilesRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canAccessProfiles;
}

export function canAccessJobsRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canAccessJobs;
}

export function canModerateCommentsRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canModerateComments;
}

export function canManageLeadNotesRole(role: string | null | undefined): boolean {
  return getRolePermissions(role).canManageLeadNotes;
}

export function homeSectionForRole(role: string | null | undefined): string {
  return getRolePermissions(role).homeSection;
}

/** App-facing role key ("admin" | "lead" | "bd") for UI colors / filters. */
export function roleUserKey(role: string | null | undefined): "admin" | "lead" | "bd" {
  return getRolePermissions(role).userRoleKey;
}
