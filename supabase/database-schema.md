# PipelineIQ — Fresh Database Schema

The database schema for the redesigned PipelineIQ platform. It replaces the old database, which was removed from the repository (`supabase/migrations/` now contains only the fresh history). All migrations run against a fresh Supabase project via the Supabase CLI.

- **Migrations:** 3 (consolidated) · **Tables:** 16 · **Status:** schema + seed data + helper/transition functions all in place. **Row Level Security is disabled on every public-schema table** — access control is enforced entirely in the backend (Next.js Route Handlers / `lib/services/*`), not by Postgres policies.
- **Workflow:** `npm run migrate:new -- <name>` → edit SQL → `npm run migrate:up` (see README)
- **Last updated:** 2026-08-23

> Migrations are intentionally comment-free (the 3 consolidated files carry header comments only); this document is the single source of truth for schema reasoning, old-DB mappings, and open questions. Keep it in sync when migrations change.

---

## 1. Conventions

| Rule | Choice |
|---|---|
| Primary keys | `uuid` + `default gen_random_uuid()` |
| Timestamps | `timestamptz`, `default now()` |
| Audit | `created_at` / `updated_at`; `updated_at` auto-set by the `update_updated_at_column()` trigger on tables that carry it |
| Soft delete | `deleted_at timestamptz` on every mutable table — nothing is hard-deleted |
| Organization scoping | `organization_id` FK on every business table |
| Access control | **RLS is disabled on every table.** Every Route Handler / `lib/services/*` function checks org membership, role, and row ownership in code before it queries or mutates — see §5.11 for the mechanism and the functions that enforce it. |

---

## 2. Migration history

The schema previously accumulated through 35 incremental migration files (`20260806104621_init_core_tables.sql` through `20260823085325_pipeline_stage_state.sql`). On 2026-08-23, as part of the decision to remove RLS and reset the database, those 35 files were consolidated into 3 files that represent the final end-state directly, rather than replaying history:

| File | Contents |
|---|---|
| `20260823200000_consolidated_schema.sql` | Extensions, enum types, all 16 tables (final columns/constraints/FKs), indexes, the `updated_at` trigger function + per-table triggers, the last-active-admin guard trigger, and the `user_activities` append-only guard trigger. No RLS anywhere. |
| `20260823200001_consolidated_auth_and_grants.sql` | `custom_access_token_hook()`, `handle_new_user()` + its `auth.users` trigger, and table GRANTs to `anon`/`authenticated`/`service_role`. No RLS policies. |
| `20260823200002_consolidated_storage.sql` | The `profile-cvs` Storage bucket, with **zero** client-facing `storage.objects` policies (deny-all for `anon`/`authenticated` — see §7). |

The 35 original migration files have been removed from disk (not merely superseded) — `supabase/migrations/` now contains only these 3 files. If that lineage is ever needed again, it lives in this repository's git history from before 2026-08-23.

> This section replaces the old per-migration table (previously 27 rows) that tracked schema evolution incrementally — with only 3 migrations now, a prose summary is clearer than a row-per-file table.

---

## 3. Table catalog

### 3.1 `organizations`

The company/tenant scope for every business entity.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL |
| allowed_email_domain | text | DEFAULT `'recursolabs.com'` — NULL or empty allows any domain |
| is_active | boolean | NOT NULL, default `true` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

### 3.2 `pipeline_stages`

Ordered stages a lead moves through after an employer reply.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL |
| order_index | integer | NOT NULL |
| state | text | NOT NULL, default `'active'`, CHECK in (`active`, `paused`, `closed`) — lets a stage be retired from new use (`paused`/`closed`) without deleting it out from under leads that still reference it |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |

**Lead Stages page** (`app/api/pipeline-stages/*`) lets Admins create/edit/reorder/retire stages; `state` is what "retire" means at the row level.

### 3.3 `users` — old DB: `profiles`

Authenticated users (staff: admins and BD executives). One row per Supabase auth user.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| role_id | uuid | NOT NULL, FK → `roles(id)` ON DELETE SET NULL |
| full_name | text | NOT NULL |
| email | text | NOT NULL, UNIQUE |
| is_active | boolean | NOT NULL, default `true` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

<!-- FLAG: the consolidated schema declares role_id as `references public.roles(id) on delete set null`, while the previous doc (and migration 20260818110241_make_role_id_not_null.sql) described it as `ON DELETE RESTRICT` specifically to "prevent a role from being deleted while users reference it." role_id is still NOT NULL, so a bare ON DELETE SET NULL on a NOT NULL column will raise a not-null violation at delete time in practice — behaviorally similar to RESTRICT for now — but it's not the same guarantee (RESTRICT fails fast and explicitly; SET NULL on a NOT NULL column fails only because of the NOT NULL constraint, which is a coincidence of two constraints rather than an intentional design). Flagging in case this was an unintentional regression during consolidation rather than a deliberate change. -->

**Why `id` references `auth.users`:** accounts are created by Admin via the Supabase invite flow (no self-signup). A user row can only exist for an authenticated identity.

**Role model:** a user has **at most one role**, held directly on `users.role_id` (1:N roles → users). The old `user_roles` M:N join table was **not** re-created.

### 3.4 `roles` — old DB: `roles`

Roles are tables, not an enum — a long-standing project decision. A user's role is a single `users.role_id` FK, not a join-table assignment.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL, UNIQUE |
| description | text | |
| created_at | timestamptz | NOT NULL, default `now()` |

### 3.5 `seniority_level`

Profile seniority levels (e.g. junior / mid / senior). Deliberately singular in the fresh DB (old DB used `seniority_levels`).

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL, UNIQUE |
| created_at | timestamptz | NOT NULL, default `now()` |

### 3.6 `profiles` — old DB: `engineers`

The profile roster — the people who are matched to jobs. Owns rate, seniority, and experience data.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| user_id | uuid | FK → `users(id)` ON DELETE SET NULL — nullable; a user may own several profiles |
| full_name | text | NOT NULL |
| email | text | NOT NULL, UNIQUE |
| phone | text | |
| location | text | |
| seniority_level_id | uuid | FK → `seniority_level(id)` — nullable |
| years_of_experience | numeric(4,1) | CHECK ≥ 0 |
| rate_expectation | numeric(10,2) | CHECK ≥ 0 |
| rate_currency | char(3) | NOT NULL, default `'USD'` |
| rate_unit | text | |
| summary | text | |
| is_active | boolean | NOT NULL, default `true` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

**Key rule:** a user can own **multiple** profiles (the old UNIQUE on `user_id` is gone), while each profile still belongs to at most one user — `user_id` is a single FK per row. Reassignment is a single update of this column, and the same user may be assigned to several profiles. The old `engineer_bd_assignments` join/history table was **not** re-created (see §6).

**Access control:** Profiles management (create/edit/assign/upload/parse CVs) is gated by `canAccessProfiles` in the `ROLE_PERMISSIONS` matrix (`lib/auth/roles.ts`) — Admin and BD Manager only, checked server-side by `requireProfileManagerUser()` in `lib/services/profiles.ts` before any mutation runs. Every route additionally calls `verifyOrganizationAccess()` (`lib/api/organization.ts`) to confirm the caller's own `users.organization_id` matches the org id the request is scoped to, before any query touches the table.

### 3.7 `profile_cvs` — old DB: `engineer_cvs`

CVs attached to a profile. A profile can have **multiple** CVs; files live in a Storage bucket, this table holds the metadata.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| storage_path | text | NOT NULL, UNIQUE — object key in the private `profile-cvs` Storage bucket (`<profileId>/<cvId>-<fileName>`); seeded rows carry paths in the same shape with no object behind them |
| file_name | text | NOT NULL |
| file_type | text | NOT NULL, CHECK in (`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) |
| file_size_bytes | bigint | NOT NULL, CHECK > 0 and ≤ 10485760 (10 MiB) |
| parsed_data | jsonb | nullable — the structured parse of the CV (v1 shape below) |
| parsed_at | timestamptz | nullable — when the successful parse landed |
| parse_status | text | NOT NULL, default `'pending'`, CHECK in (`pending`, `success`, `failed`) |
| parse_error | text | nullable — why the last parse attempt failed |
| parse_model_version | text | nullable — the AI model that produced `parsed_data` |
| parse_schema_version | integer | nullable — the `parsed_data` format version |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

**Parsing is per CV, not per profile.** A profile can hold several CVs and
`job_profile_matches` scores each one separately, so each CV carries its own
parse. `CHECK (parse_status <> 'success' OR (parsed_data, parsed_at,
parse_schema_version all NOT NULL))` keeps a `success` row from being
indistinguishable from an unparsed one.

**Operational contract:** the row is inserted `pending`; the parse runs *after*
the upload response (`after()`), so a Groq rate-limit can never fail an
otherwise-good upload. A failure records `parse_status = 'failed'` +
`parse_error` and leaves the file intact. `parse_schema_version` makes a format
change a targeted re-parse (`where parse_schema_version < 2`) rather than a
guess about which rows are stale. A partial index on `parse_status` (where it
isn't `success`) backs the sweep, which only ever looks for unfinished work.

**`parsed_data` v1 shape.** Top-level keys are the contract — `parsed_data ->
'skills'` is a flat array of skill strings, readable without walking
`experience`. Every field is nullable and every array defaults to `[]`, because
real CVs are sparse. Dates are `"YYYY-MM"` strings, or `"YYYY"` when the CV
gives only a year — a day is dropped even when present, and a year-only date is
**not** padded to `"YYYY-01"`, because inventing a month states a fact the
document never did. `end_date: null` with `is_current: true` means present, and
the two are reconciled on parse (no end date ⇒ current). Skills are deduped
case-insensitively but
stored as written (`"Node.js"`, not `"nodejs"`) — matching-time normalization
already lives in `normalizeForMatch()`. Raw CV text is deliberately **not**
stored here, so reading the parse doesn't drag a whole document through
Postgres.

```
schema_version           1
candidate                { full_name, email, phone, location, links: { linkedin, github, portfolio } }
headline                 short professional title
summary                  free-text professional summary
total_years_experience   number — a hint, not authoritative
seniority_hint           string — a hint, not authoritative
skills                   ["React", "Node.js", …]          ← the flat contract
skill_groups             [{ category, skills[] }]
titles                   job titles held
industries               domains worked in
experience               [{ company, title, location, start_date, end_date, is_current, highlights[], skills[] }]
education                [{ institution, degree, field_of_study, start_date, end_date }]
certifications           [{ name, issuer, issued_date, expires_date }]
languages                [{ name, proficiency }]
projects                 [{ name, description, url, skills[] }]
```

No `duration_months`: it would be derived from the dates and, for a current
role, would silently go stale the moment it was written. Consumers compute it
from `start_date` / `end_date` instead.

`skills` is the flat contract and is complete on its own — it includes skills
named only inside a single role or project, not just those in a CV's Skills
section, so a consumer never has to walk `experience` to find them.

`total_years_experience` and `seniority_hint` are **hints only** —
`profiles.years_of_experience` and `profiles.seniority_level_id` stay
authoritative because a human set them. The parsed values give a discrepancy
signal and let a profile with no typed data still be scored.

### 3.8 `scrapers` — old DB: `job_sources`

The job-source registry (which scraper ingested a job posting).

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL |
| base_url | text | NOT NULL |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

### 3.9 `cron_run_locks`

Single-run mutex so two overlapping cron invocations never run discovery in parallel.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| is_running | boolean | NOT NULL, default `false` |
| started_at | timestamptz | |
| last_completed_at | timestamptz | |
| updated_at | timestamptz | NOT NULL, default `now()` |

### 3.10 `jobs` — old DB: `jobs`

Job postings ingested from external sources via scrapers.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| scraper_id | uuid | NOT NULL, FK → `scrapers(id)` |
| external_job_id | text | NOT NULL — id of the job in the source system |
| title | text | NOT NULL |
| company_name | text | NOT NULL |
| company_location | text | |
| description | text | |
| apply_url | text | NOT NULL |
| is_remote | boolean | |
| remote_allowed_region | text | free text (e.g. `Worldwide`, `US only`) — deliberately not a lookup table |
| job_posted_at | timestamptz | |
| created_at | timestamptz | NOT NULL, default `now()` |
| is_globally_open | boolean | nullable — likely redundant with `remote_allowed_region` |
| possibly_closed | boolean | NOT NULL, default `false` |
| possibly_closed_reason | text | |
| parsed_data | jsonb | nullable — free-form AI-parse bucket (manual-job "source"/"budget" extras, etc.) |
| engagement_type | `job_engagement_type` enum | nullable — `inbound` (client approached us) or `outbound` (we applied); null = unclassified |
| manual_overrides | text[] | NOT NULL, default `'{}'` — column names a user has hand-edited via the job edit UI; CHECK restricts values to a known column set (`title`, `company_name`, `company_location`, `description`, `apply_url`, `is_remote`, `job_posted_at`) |
| | | UNIQUE (`scraper_id`, `external_job_id`) |

The `UNIQUE (scraper_id, external_job_id)` constraint prevents duplicate ingest of the same posting.

**`manual_overrides` protects hand edits from the nightly cron.** When a user edits one of the listed columns on a scraped job (`app/api/jobs/[jobId]/route.ts`), the edited column names are added to `manual_overrides`; the discovery cron's upsert (`lib/cron/discover-jobs.ts`) reads this array and skips overwriting any column named in it on that job's next refresh.

**`engagement_type`** classifies how a job reached the org (`inbound`/`outbound`), set optionally at manual-job creation (`lib/services/manual-jobs.ts`) or left null for scraped jobs and manual jobs where the user didn't specify it.

**Manually added jobs** (the Pipeline page's "New Job" flow, POST `/api/jobs`) reuse this table: `scraper_id` points at the seeded `Manual` scraper (the typed source text lives on `parsed_data.source`), `external_job_id` is a random uuid the scrapers can never produce — so the AI cron's upsert (keyed on `scraper_id` + `external_job_id`) can never collide with or overwrite them. `is_globally_open` is set `true` at insert so the job surfaces in everyone's Discovery; the chosen profile's `job_profile_states` row carries the applied/dismissed state and the applied-on date (`created_at`), and every other profile has no row at all = suggested. `apply_url` is `''` when no URL was given. The manual extras (skills, budget, exp. compensation, source, developer) live on `parsed_data` — the `ParsedJobData` type in `lib/ai/client.ts` gained optional `budget` / `source` / `developer` fields for them.

**Access control:** any org member can create a job (`canAccessJobs`); editing a job's own fields is gated by `canEditJobs` (Admin + BD Manager) in `ROLE_PERMISSIONS` (`lib/auth/roles.ts`), checked in `app/api/jobs/[jobId]/route.ts` — Business Developers may create a job but not edit one. Every route scopes reads/writes to the caller's own org via `verifyOrganizationAccess()`.

### 3.11 `leads` — old DB: `leads`

**A lead is an applied job that received an employer reply.** It carries the pipeline position of that reply.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| job_id | uuid | NOT NULL, FK → `jobs(id)` |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` |
| job_profile_state_id | uuid | FK → `job_profile_states(id)` |
| user_id | uuid | nullable, FK → `users(id)` ON DELETE SET NULL — owner snapshot (null once the applier's account is deleted; the lead stays with the profile) |
| pipeline_stage_id | uuid | NOT NULL, FK → `pipeline_stages(id)` |
| applied_at | timestamptz | NOT NULL, default `now()` |
| last_activity_at | timestamptz | NOT NULL, default `now()` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |
| notes | text | NOT NULL, default `''` — Applier's Notes |
| developer | text | nullable — who is handling this lead; lead-specific (a job may have many leads, one per applying profile), distinct from `jobs`' own fields |

**Owner semantics:** `user_id` is a permanent snapshot taken at lead creation (who applied); it does not move if the profile is later reassigned. But **access follows the profile**: the lead's owner for the app layer is the profile's CURRENT assigned user (`profiles.user_id`), with the snapshot kept as an additional branch so the original applier keeps visibility after a reassignment. Leads created by an Admin/BD Manager on behalf of a profile, or whose applier's account was deleted (snapshot NULLed), still land on the developer assigned to the profile. This is enforced in `app/api/leads/[leadId]/route.ts`, which computes `isProfileOwner` from `profiles.user_id` alongside the `user_id` snapshot.

**Applier's Notes:** `notes` is writable by the profile's current assigned user (or the original-applier snapshot) plus any role with `canManageLeadNotes` in `ROLE_PERMISSIONS` (Admin + BD Manager) — checked explicitly in the PATCH handler (`app/api/leads/[leadId]/route.ts`) before a notes update is allowed, and gated the same way in the UI. Status/stage changes follow the same owner-or-admin rule. Assigning `developer` is a separate check, gated on `canEditJobs` (the same roles that may edit a job's own fields).

### 3.12 `job_profile_matches` — old DB: `job_engineer_matches` (scoring half)

AI relevance score for **each CV** of a profile against a job — one row per `(job, profile, cv)`, because different CVs have different impact on the same job. This table only visualizes which CV best suits a job for a profile; it carries no application state.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| job_id | uuid | NOT NULL, FK → `jobs(id)` |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` |
| cv_id | uuid | NOT NULL, FK → `profile_cvs(id)` |
| relevance_score | numeric(5,2) | NOT NULL, CHECK 0–100 |
| ai_model_version | text | NOT NULL |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| | | UNIQUE (`job_id`, `profile_id`, `cv_id`) |

### 3.13 `job_profile_states` — old DB: `job_engineer_matches` (application half)

The current application state of a job against a profile, plus the metadata of each attempt: which user applied and which CV they chose (picked after seeing the `job_profile_matches` scores). One live row per `(job, profile)`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| job_id | uuid | NOT NULL, FK → `jobs(id)` |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` |
| status | `application_status` | NOT NULL, default `'suggested'` |
| user_id | uuid | nullable, FK → `users(id)` ON DELETE SET NULL (system suggestions; cleared when the acting user's account is deleted) |
| cv_id | uuid | FK → `profile_cvs(id)` — nullable (CV chosen for the application) |
| dismissed_reason | text | nullable — set when the pair is dismissed |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

**Key rule:** the live state per `(job, profile)` pair is the row with `deleted_at IS NULL`, enforced by a partial unique index (`job_id, profile_id WHERE deleted_at IS NULL`). Superseded attempts are soft-deleted, so the which-user-which-CV history stays queryable — no `is_current` column. **Rows are lazy:** created only on first user action (`applied` / `dismissed`); a pair with no row is `suggested` by default.

### 3.14 `job_comments`

Flat team discussion on a job — anyone in the org can comment, everyone in the org sees the thread. No replies, no `parent_id`.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` — the job's org (same as the commenter's org) |
| job_id | uuid | NOT NULL, FK → `jobs(id)` ON DELETE CASCADE |
| user_id | uuid | NOT NULL, FK → `users(id)` ON DELETE CASCADE — author |
| body | text | NOT NULL, CHECK length 1–2000 |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | soft delete — history survives; the app hides deleted rows |

**Permissions:** any authenticated user of the job's org can read and comment — enforced by `verifyOrganizationAccess()` scoping the query to the caller's own org, checked in `app/api/jobs/[jobId]/comments/route.ts` / `app/api/comments/[commentId]/route.ts`. Edits are author-only; deletes are author-or-admin (`canModerateComments` in `ROLE_PERMISSIONS`). Comments are org-scoped end-to-end, matching every other business table.

### 3.15 `audit_logs`

The security / team-management trail: login, password_set, invite_sent, user_updated, user_deleted. Written by `lib/api/audit.ts`'s `logAudit()`, best-effort, after the operation it records has already succeeded.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| actor_user_id | uuid | FK → `users(id)` ON DELETE SET NULL — the acting user |
| action | text | NOT NULL — `AuditAction` union in `lib/api/audit.ts` is the source of truth |
| target_user_id | uuid | FK → `users(id)` ON DELETE SET NULL — the member the action is about, when different from the actor |
| target_email | text | snapshot, for targets deleted before the log write (e.g. `user_deleted`) |
| ip_address | text | |
| metadata | jsonb | NOT NULL, default `{}` |
| created_at | timestamptz | NOT NULL, default `now()` |

**No `updated_at` / `deleted_at`** — append-only by design, not an oversight (see `user_activities` below for the same divergence, spelled out in full). **Permissions:** the GRANTs give `authenticated` `select, insert` on this table (§7), but that is not itself the access boundary — inserts happen only through `logAudit()`, called server-side with the acting user's own id and org already known; reads are restricted to Admins in the API layer (the routes that expose audit data check `canViewUsers`/admin status before querying, not a DB policy) — this is the team-management trail, not a general activity feed, so BD Managers do not see it (contrast with `user_activities`, which they do see org-wide).

### 3.16 `user_activities`

The product's business-activity feed: profiles, jobs, leads, comments, and discovery actions. Written by `lib/api/activity.ts`'s `logActivity()`, best-effort, after the operation it records has already succeeded. Deliberately a **separate table from `audit_logs`** — that one is the Admin-only security trail; this one has a wider, role-scoped audience, and keeping them apart means widening this feed's visibility can never widen access to login/invite/member-deletion records.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| user_id | uuid | FK → `users(id)` ON DELETE SET NULL — the actor |
| actor_name | text | NOT NULL, snapshot — a deleted user's activity still renders as a person |
| action | text | NOT NULL, CHECK `^[a-z][a-z0-9_]{2,63}$` — `ActivityAction` union in `lib/api/activity.ts` is the source of truth, not an enum, so a new action needs no migration |
| entity_type / entity_id | text / uuid | polymorphic, no FK — points at profiles/jobs/leads/CVs/comments without a column per entity type, and survives the subject being deleted (the point of a log); CHECK: an id implies a type |
| entity_label | text | snapshot of the subject's name/title at the time, ≤300 chars |
| description | text | NOT NULL, CHECK length 1–500 — the rendered, human-readable sentence for the feed; a snapshot, same reasoning as `entity_label` |
| metadata | jsonb | NOT NULL, default `{}` — structured extras, not used for display |
| ip_address | text | |
| created_at | timestamptz | NOT NULL, default `now()` |

**No `updated_at` / `deleted_at` — a deliberate divergence from §1's "every mutable table gets `deleted_at`" convention.** A row here is written once and never touched again, so there is nothing to soft-delete or update; recording a "deleted" activity would also directly contradict the append-only requirement below.

**Append-only, now enforced two ways (RLS is not used anywhere in this schema, so it was never part of this guarantee for `service_role`/`TRUNCATE` — see below):**
1. Grants: `authenticated` and `service_role` hold only `SELECT, INSERT` on this table (§7) — no `UPDATE`, `DELETE`, or `TRUNCATE` verb is granted to either role.
2. Triggers (`prevent_user_activity_mutation()`) that raise on UPDATE, DELETE, and TRUNCATE (a separate statement-level trigger for TRUNCATE, since it never fires row-level triggers) — these fire regardless of role, including `service_role`/`postgres` directly, which is what actually makes this guarantee hold even against a superuser-equivalent credential; the grants above are defense in depth on top of it, not the primary mechanism.

**Permissions:** insert is bound to `user_id = auth.uid()` (checked in `lib/api/activity.ts`'s `logActivity()`, which is always called with the current request's own user id) in the caller's own org — application code, not a DB constraint, prevents one user from forging an entry attributed to someone else. Read visibility is enforced in the API layer: Admin + BD Manager see the feed org-wide (`canViewUsers`-equivalent privileged check), everyone else sees only their own rows (`user_id` filter added to the query) — matching the spec that BD Managers get full visibility like Admins.

---

## 4. Relationships

```
organizations 1─N users
organizations 1─N profiles
organizations 1─N jobs
organizations 1─N leads

auth.users 1─1 users
roles 1─N users                (users.role_id — at most one role per user)
users 1─N profiles            (a user may own several profiles)
profiles 1─N profile_cvs
profiles N─1 seniority_level

scrapers 1─N jobs
jobs N─M profiles             (via job_profile_matches — one score row per CV)
job_profile_matches N─1 profile_cvs          (per-CV scoring)
job_profile_states N─1 jobs, N─1 profiles    (one live state per pair)
job_profile_states N─1 users  (who acted)
job_profile_states N─1 profile_cvs           (CV chosen for the application)

jobs N─1 leads, profiles N─1 leads, users N─1 leads,
pipeline_stages 1─N leads,
job_profile_states 1─N leads  (the replied application)

jobs 1─N job_comments, users 1─N job_comments  (authors)

organizations 1─N audit_logs, users 1─N audit_logs           (actor; target_user_id is a second, unenforced FK-style reference)
organizations 1─N user_activities, users 1─N user_activities (actor only — entity_type/entity_id are polymorphic, no FK)
```

### Invariants

1. A user has at most one role (`users.role_id` NOT NULL FK — no join table).
2. A profile has at most one assigned user (`profiles.user_id` FK); a user may own many profiles.
3. Exactly one live `job_profile_states` row per (job, profile) pair (partial unique index).
4. A job posting is unique per source (`UNIQUE (scraper_id, external_job_id)`).
5. A lead references the specific application attempt that received the reply.

---

## 5. Design decisions & reasoning

1. **Fresh database, old migrations removed.** The schema is heavily modified (dropped tables/columns, new tables), so the old history was removed instead of migrated. As of 2026-08-23 this applies twice over: the original pre-fresh-DB history, and then the 35 fresh-DB incremental migrations that were themselves consolidated into the 3 files described in §2.

2. **`users.id` = `auth.users.id`.** Accounts come from the Admin invite flow; a user row cannot exist without an authenticated identity.

3. **One role per user, held on `users.role_id`** (roles 1─N users). The old `user_roles` M:N join table was dropped — a user has exactly one role, so an assignment table bought nothing.

4. **A user can own multiple profiles; each profile belongs to at most one user** (`profiles.user_id` FK — no UNIQUE constraint, so a user isn't capped at one profile). This replaces the many-to-many `engineer_bd_assignments`: ownership is a single FK update, and the old table's only remaining value — which user used which profile to apply — is covered by `leads` (permanent `user_id` owner snapshot).

5. **Multiple CVs per profile** (`profile_cvs` 1:N). The old "one recommended CV" pointer is replaced by a per-application `cv_id`, so each application records exactly which CV was sent.

6. **`job_engineer_matches` split into two tables.** The old table conflated score, status, and a single recommended CV in one row locked to `unique(job, engineer)`. In the fresh design the AI scores **each CV of a profile against each job separately** (`job_profile_matches` — one row per job + profile + cv), because different CVs have different impact on the same job. Scores refresh freely on every cron run — no status to lock, so the old "only refresh while `suggested`" rule disappears.

7. **Application state is its own lifecycle table (`job_profile_states`), not a column.** It holds the current state of a job against a profile plus the metadata of each attempt: which user applied and which CV they chose after seeing the `job_profile_matches` scores. Keyed directly on `(job_id, profile_id)` — no link to a specific match row. Superseded attempts are soft-deleted; the live row is `deleted_at IS NULL` (partial unique index enforces one live row per pair). Re-application after a profile change = soft-delete the old attempt and insert a new one.

8. **`application_status` enum has exactly `suggested`, `dismissed`, `applied`.** Post-reply outcomes are handled by `leads` + `pipeline_stages`, not by this enum. `dismissed_reason` records why a pair was dismissed (drives the dismiss UX).

9. **A lead is created by the user from the Pipeline page** (POST `/api/leads` with the `(job, profile)` pair), wrapping an applied application: it pins the state row (`job_profile_state_id`), takes `applied_at` from the state row, and records the permanent owner snapshot (`user_id` = the profile's assigned user). **Duplicate-lead rule is enforced in the API** — at most one live lead per `(job, profile)` pair; the POST is idempotent and returns the existing lead.

10. **Soft delete everywhere.** History is preserved by rows marked `deleted_at`, never destroyed.

11. **Access control lives entirely in the backend; RLS is disabled on every table (decision made 2026-08-23, reversing the earlier RLS-first model).** Every table's real access boundary is now a Route Handler / `lib/services/*` check, not a Postgres policy:
    - `verifyOrganizationAccess()` (`lib/api/organization.ts`) confirms the org id a request is scoped to matches the caller's own `users.organization_id` — used at the top of nearly every route (`app/api/profiles/*`, `app/api/jobs/*`, `app/api/leads/*`, `app/api/discovery/*`, `app/api/users/*`, `app/api/comments/*`, etc.) before any query runs.
    - The `ROLE_PERMISSIONS` matrix (`lib/auth/roles.ts`) is the single source of truth for what each role (`Admin`, `BD Manager`, `Business Developer`) may do (`canAccessProfiles`, `canEditJobs`, `canManageLeadNotes`, `canManageLeadStages`, `canModerateComments`, `canManageUsers`, `canInviteUsers`, etc.), read via `getCachedRolePermissions()` and checked explicitly in each route/service function — e.g. `requireProfileManagerUser()` in `lib/services/profiles.ts` for Profiles, the notes-ownership check in `app/api/leads/[leadId]/route.ts` for Applier's Notes.
    - There are no SECURITY DEFINER helper functions backing table access any more — `is_admin()`, `is_bd_manager()`, `current_org_id()`, `is_admin_in()`, and `is_privileged_in()` existed only to back RLS policies and were not recreated in the consolidated schema; they are dead concepts, not just dead code.
    - GRANTs to `anon`/`authenticated`/`service_role` (§7) now express only which SQL verbs a role's client may issue against a table — they say nothing about which rows a given caller may see, since there's no RLS row filter behind them any more. Never treat a GRANT as a security boundary by itself.
    - The cron writes with the service-role key (`createAdminClient()`), same as before — that was never RLS-gated even when RLS existed, since `service_role` bypasses RLS entirely.
    - <!-- FLAG: lib/auth/roles.ts's own comments (lines ~18-28) still describe RLS as "the real access boundary" that "must be widened for any new role" and say the JWT claim is re-checked by "RLS ... against the live table" — this is application-code documentation, not this schema doc, so it's out of scope for this pass, but it is now factually stale post-RLS-removal and should be updated separately. Likewise app/api/leads/[leadId]/route.ts has an inline comment ("RLS scopes this to the owner...") that is no longer accurate. Flagging for a follow-up code-comment cleanup pass. -->

12. **`organization_id` on every business table.** Enables multi-organization scoping from day one.

13. **`rate_expection` (spec) is `rate_expectation`** and **`possibaly_closed` → `possibly_closed`** — spec typos corrected to the old codebase's spellings.

14. **JWT carries `is_admin` / `user_role`.** `custom_access_token_hook()` reads `users.role_id` → `roles.name` and bakes the claims into issued tokens; `middleware.ts` / `getCachedIsAdmin()` read them locally. This mechanism is independent of RLS — it's a Postgres Auth Hook, not a policy — and is unaffected by the RLS removal. Server-side route/service code still re-derives and checks permissions via `getCachedRolePermissions()` rather than trusting the claim blindly for authorization decisions with real consequences (the claim is treated as an app-layer convenience for UI/middleware routing, e.g. `middleware.ts` gating `/admin/*`).

15. **Comments are an open org-wide thread, not an owner-scoped record.** Unlike leads (owner snapshot) or notes (applier-only), any org member can read and comment on any of the org's jobs — scoped by `organization_id` via `verifyOrganizationAccess()` in the route, not by `user_id`. Comments are **flat** — deliberately no `parent_id`/replies. The drawer surfaces the same thread for a job everywhere (Discovery, Pipeline, and Leads via `commentsJobId`), since a lead wraps the same job.

16. **Org scoping is enforced identically everywhere, backend-side, since the RLS removal.** Before 2026-08-23, org scoping was a two-layer thing: RLS policies (composed from `current_org_id()` / `is_admin_in(org)` / `is_privileged_in(org)`) plus app checks. Now it's one layer: every route calls `verifyOrganizationAccess()` up front and every query that follows is explicitly filtered by that verified `organization_id` — there is no second, DB-level check behind it. Reference tables with identical rows for every org (`roles`, `pipeline_stages`, `seniority_level`, `scrapers`) were never org-scoped (no `organization_id` column) and need none, since duplicating catalog rows per org would buy nothing.

17. **Two audit tables, split by audience, not one.** `audit_logs` is the security/team-management trail — logins, invites, member changes — and stays Admin-only to read, on purpose (enforced in the API layer, not by a DB policy). `user_activities` is the product's business-activity feed — profiles, jobs, leads, comments, discovery — visible org-wide to Admin **and** BD Manager, matching the Business Developer permission model everywhere else. They were kept as separate tables specifically so that widening the feed's audience (as the product requires) could never widen access to the security trail (which must not). Both are append-only by construction — see §3.15/§3.16; `user_activities`' append-only guarantee is trigger-enforced (holds even against `service_role`/`TRUNCATE`), `audit_logs`' is enforced by application code always calling `logAudit()` rather than issuing raw UPDATE/DELETE.

18. **CV files live in Supabase Storage, service-role only.** `profile_cvs.storage_path` is an object key (not a URL) in the private `profile-cvs` bucket. `storage.objects` has no client-facing policies at all — see §7 for why "no policy" means deny-all here rather than open-all, and how that differs from the disabled-RLS model on public-schema tables.

---

## 6. Renames from the old database

| Old DB | Fresh DB |
|---|---|
| `profiles` | `users` |
| `user_roles` (M:N join) | dropped — role lives on `users.role_id` |
| `engineers` | `profiles` |
| `engineers.years_experience` | `profiles.years_of_experience` |
| `engineers.created_by` | dropped |
| `engineer_cvs` | `profile_cvs` |
| `engineer_cvs.engineer_id` | `profile_cvs.profile_id` |
| `engineer_cvs.mime_type` | `profile_cvs.file_type` |
| `engineer_cvs.label / uploaded_by / is_current` | dropped |
| `job_sources` | `scrapers` |
| `jobs.job_source_id` | `jobs.scraper_id` |
| `jobs.location` | `jobs.company_location` |
| `jobs.remote_region` | `jobs.remote_allowed_region` |
| `jobs.posted_at` | `jobs.job_posted_at` |
| `jobs.discovered_at / dedup_hash` | dropped |
| `leads.engineer_id` | `leads.profile_id` |
| `leads.job_engineer_match_id` | `leads.job_profile_state_id` |
| `leads.bd_user_id` | `leads.user_id` |
| `leads.current_stage_id` | `leads.pipeline_stage_id` |
| `leads.status` | dropped (pipeline stage carries it) |
| `job_engineer_matches` | `job_profile_matches` (per-CV scoring) + `job_profile_states` (application state) |
| `job_engineer_matches.recommended_cv_id` | per-CV rows: `job_profile_matches.cv_id` (scored) and `job_profile_states.cv_id` (chosen at apply) |
| `engineer_bd_assignments` | dropped (ownership on `profiles.user_id` — a user may own several profiles) |
| `seniority_levels` | `seniority_level` |
| `seniority_levels.rank` | dropped |
| `cron_run_locks.id` (text job-key) | `cron_run_locks.id` (uuid); added `last_completed_at` |

---

## 7. Storage — CV files (`profile-cvs` bucket)

The `profile-cvs` bucket (private, 10 MiB limit, PDF/DOC/DOCX only) holds uploaded CV files; `profile_cvs.storage_path` holds the object key, not a URL.

**Access model: deny-all for clients, service-role-only, signed URLs for downloads.** `storage.objects` carries no client-facing policies at all for this bucket — no SELECT/INSERT/UPDATE/DELETE policy exists for `authenticated` or `anon`. Supabase force-enables RLS on `storage.objects` and this project's migration role cannot disable it, so on this one system table (unlike every public-schema table, where RLS is simply turned off) "no policy" functions as deny-all rather than open-all: a session holding only its own user JWT has zero ability to read, upload, or delete any object in this bucket, even by calling the Storage API directly and bypassing the app entirely.

The only credential that can touch bucket contents is the service-role key, via `createAdminClient()` (`lib/supabase/admin.ts`). Every Storage call in the app — upload, delete, download-URL minting, and the CV-parse pipeline — now goes through this admin client:
- `lib/services/profiles.ts` (upload/delete via `lib/supabase/storage.ts`'s `uploadCvFile()` / `deleteCvFile()`)
- `app/api/profiles/[profileId]/route.ts` (signed download URLs)
- `app/api/profiles/[profileId]/cvs/[cvId]/parse/route.ts` (reading the file to parse it)
- `lib/cv-parsing/parse-cv.ts`

A client never talks to Storage directly. To let a user download a CV, the backend first runs its normal authorization check (org membership, role, profile ownership — the same checks used for every other resource) and only then mints a short-lived signed URL via `createSignedUrl()` (`lib/supabase/storage.ts`), valid for `CV_DOWNLOAD_URL_TTL_SECONDS` (900 seconds / 15 minutes), scoped to that one object. The signed URL, not a bucket grant, is what the browser actually uses to fetch the file.

This is the intended enterprise pattern for private object storage without a database-level row filter behind it: the same shape used by apps backed by S3/GCS/Azure Blob when access is enforced entirely at the application layer — the storage credential lives only on the server, never in a client-held session token.

An earlier draft considered a coarse `authenticated`-plus-bucket-name policy as a replacement for the old org/role-scoped `storage.objects` policies (which had mirrored `profile_cvs`'s RLS via `(storage.foldername(name))[1]` to recover the profile id from the object path). That was rejected: it would let any authenticated session touch any CV object directly via the Storage API, a materially weaker boundary than "no client access at all, backend-mediated." Deny-all + backend-only credential was chosen instead, and needs no RLS-helper functions to exist.

---

## 8. Grants summary

Since there is no RLS anywhere in this schema, GRANTs are the only DB-level access control that remains — but they answer a narrower question than before: not "which rows," only "which verbs, on which tables, for which role." Row-level authorization is entirely the backend's job (§5.11).

- **`anon`** — no privileges on any public-schema table, and no `USAGE` on `application_status` or `job_engagement_type`. `anon` was never a supported access path in this app; this is unchanged from before the RLS removal. `alter default privileges ... revoke all on tables from anon` keeps any future table from re-inheriting access.
- **`service_role`** — full, unrestricted access to every table (`grant all privileges on all tables in schema public`). This was already true before the RLS removal, since `service_role` bypasses RLS entirely — the removal changes nothing about this role's reach, only about what `authenticated` and application code can rely on.
- **`authenticated`** — per-table grants matching the verbs the backend's Route Handlers actually issue via the authenticated client (e.g. `select, insert, update, delete` on `users`; `select, insert, update` on `profiles`/`profile_cvs`/`job_profile_states`/`leads`/`job_comments`; `select` only on `job_profile_matches`; `select, insert` on `audit_logs`/`user_activities`, matching their append-only-by-convention design). These grants intentionally follow a coarser model than the pre-2026-08-23 migrations' "narrow grant + RLS row filter" combination, because there is no RLS row filter behind them any more — the grant says which verbs the backend may issue with the authenticated client, not which rows a given caller may see. Every table's real access boundary is now enforced in `app/api/*` (§5.11).

---

## 9. Open questions

1. **`leads.job_profile_state_id` is nullable.** The old `leads.job_engineer_match_id` was NOT NULL. Every lead should have a state row — decide whether to enforce NOT NULL.
2. **`withdrawn` / `closed` are not in `application_status`.** Currently the post-reply flow lives entirely on `leads` + `pipeline_stages`. Add them to the enum if withdrawal/closure must be recorded as states.
3. **`jobs.is_globally_open`** is likely redundant with `remote_allowed_region = 'Worldwide'`. Confirm whether to keep, derive, or drop.
4. **`cron_run_locks` uses a uuid key with a seeded row** (`00000000-0000-4000-8000-000000000090`) looked up by `lib/cron/discover-jobs.ts`. The old table used text job-keys (`'discover-jobs'`); this is a hardcoded uuid convention instead. Consider whether a text key would be more legible operationally.
5. **`profiles.user_id` is nullable.** A profile may exist without a user, and a user may have zero profiles. Confirm the intended direction — specifically whether external candidates (no login) should still be representable.
6. **`users.organization_id` is NOT NULL.** An organization row must exist before any user/profile can be inserted. Addressed by the seed data (`seed.sql` creates the `Recurso Labs` organization).
7. **Duplicate-lead rule.** Enforced in the API (POST `/api/leads` returns the existing live lead for the pair). A partial unique index could harden it at the DB level later.
8. **Re-application atomicity.** When lead creation returns, updating/creating the `job_profile_states` row and the lead must be atomic — today mark-applied is a single table INSERT/UPDATE, so nothing spans tables yet. Remaining gap: `reassign` has no fresh equivalent yet (Phase 3 — profile reassignment is a plain `profiles.user_id` update today). POST `/api/jobs` (manual job creation) is the first multi-table write: job + state row + (for "lead" state) a lead, inserted sequentially — every failure-prone input (profile, Manual scraper, stage) is validated before the first insert, so a mid-flight failure is a transient DB error, but a transaction/RPC would still be the hardening move.
9. **Soft-deleted state rows referenced by leads.** A lead can point to a state row that is later soft-deleted — lead queries must not filter the joined state by `deleted_at IS NULL`.
10. **`rate_currency char(3)`** pads values with spaces in Postgres; comparisons need trimming. Inherited from the old schema — consider `text` + length check if it causes friction.
11. **`cv_id` cross-table integrity.** Nothing enforces that a `job_profile_matches.cv_id` or `job_profile_states.cv_id` belongs to the same profile as the row's `profile_id` — needs app-level validation (a composite FK doesn't fit cleanly).
12. **`users.role_id` FK action** — see the `<!-- FLAG -->` in §3.3: the consolidated migration declares `ON DELETE SET NULL` on a NOT NULL column, which behaves like a delete-time failure in practice but isn't the same explicit guarantee as the previously-documented `ON DELETE RESTRICT`. Worth confirming this was intentional during consolidation.

---

## 10. Seed data & not yet built

**Seed data** — reference and demo data for a fresh database:

| Source | What it seeds |
|---|---|
| `supabase/seed.sql` (runs automatically on `supabase db reset` via `[db.seed]` in `config.toml`) | Data-API grants (`anon` read, `authenticated`/`service_role` full + enum usage), `Recurso Labs` organization, `Admin`/`User` roles, seniority levels (`Lead`/`Senior`/`Mid`/`Junior`), pipeline stages (`Applied` → `Closed`; the frontend reads these dynamically, so their names/order are the UI source of truth — the last one is the terminal "done" stage), `Jsearch` scraper, 2 profiles (`Saad Mumtaz`, `Hashir Rehman`), 1 CV for each profile (dummy paths), 2 jobs (YO AI Labs, Mercor). Idempotent — fixed UUIDs + `ON CONFLICT DO NOTHING` |
| `scripts/createUser.cjs` (`npm run seed:user`) | The admin auth user (Fareed Zafar) via the service-role admin API — auth identities cannot be created from SQL — plus the matching `users` row with a single `Admin` role via `users.role_id`, and links the `Saad Mumtaz` profile to the user (ownership). Idempotent; requires migrations + `seed.sql` applied first |

<!-- FLAG: supabase/seed.sql itself was not re-read in this pass (out of scope for this rewrite, which focused on the 3 consolidated migrations and this doc), so if it still grants privileges based on the old RLS-era assumptions (e.g. redundant with or conflicting with the new consolidated grants), that's unverified here. -->

**Not yet built:**

- The old leads module — the static `LeadsTab` is the current UI; a fresh leads module will be built against this schema when real data lands
