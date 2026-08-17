# PipelineIQ — Fresh Database Schema

The database schema for the redesigned PipelineIQ platform. It replaces the old database, which was removed from the repository (`supabase/migrations/` now contains only the fresh history). All migrations run against a fresh Supabase project via the Supabase CLI.

- **Migrations:** 25 · **Tables:** 16 · **Status:** schema + seed data + RLS policies + helper/transition functions all in place
- **Workflow:** `npm run migrate:new -- <name>` → edit SQL → `npm run migrate:up` (see README)
- **Last updated:** 2026-08-13

> Migrations are intentionally comment-free; this document is the single source of truth for schema reasoning, old-DB mappings, and open questions. Keep it in sync when migrations change.

---

## 1. Conventions

| Rule | Choice |
|---|---|
| Primary keys | `uuid` + `default gen_random_uuid()` |
| Timestamps | `timestamptz`, `default now()` |
| Audit | `created_at` / `updated_at`; `updated_at` auto-set by the `update_updated_at_column()` trigger on tables that carry it |
| Soft delete | `deleted_at timestamptz` on every mutable table — nothing is hard-deleted |
| Organization scoping | `organization_id` FK on every business table |
| Access control | Row Level Security enabled on every table; policies + `is_admin()` live in migration 5 |

---

## 2. Migrations

| # | Migration file | Creates |
|---|---|---|
| 1 | `20260806104621_init_core_tables.sql` | `organizations`, `pipeline_stages`, `roles`, `users` (incl. `role_id` FK), `seniority_level`, trigger function |
| 2 | `20260806130000_profiles_cvs_scrapers_locks.sql` | `profiles`, `profile_cvs`, `scrapers`, `cron_run_locks` |
| 3 | `20260806150000_jobs_leads.sql` | `jobs`, `leads` (incl. `notes`), `leads.applied_at` index |
| 4 | `20260806160000_job_matches_and_states.sql` | `application_status` enum, `job_profile_matches`, `job_profile_states`, `leads.job_profile_state_id` FK |
| 5 | `20260806190000_custom_access_token_hook.sql` | `custom_access_token_hook()` (JWT `is_admin` / `user_role` claims) |
| 6 | `20260806200000_rls_policies_and_helpers.sql` | `is_admin()` + RLS policies for all 13 tables (leads: select/insert/update scoped to the owner snapshot `user_id`) |
| 7 | `20260806210000_discovery_functions.sql` | `job_profile_states.dismissed_reason` (match scores are upserted straight from the cron — no SQL function) |
| 8 | `20260806220000_cron_lock_and_auth_triggers.sql` | seeds the `cron_run_locks` row; `handle_new_user()` auth trigger (auth.users → users auto-create) |
| 9 | `20260806230000_security_and_constraint_hardening.sql` | trigger helper `search_path`; `profiles.user_id` FK `ON DELETE SET NULL`; `profile_cvs` MIME/size/unique-storage-path constraints; `job_profile_states` update policy allows profile owners to set `applied` / `dismissed` |
| 10 | `20260809120000_job_comments.sql` | `job_comments` (flat team discussion on jobs — additive, applied via `db push`, no reset) |
| 11 | `20260809130000_drop_job_comments_parent_id.sql` | Drops `job_comments.parent_id` and its index — follow-up to migration 10, confirming comments are flat with no replies; the table had gone live only minutes earlier so no reply rows existed to migrate |
| 12 | `20260810094117_profile_cv_parsed_data.sql` | `profile_cvs` parse columns (`parsed_data` jsonb + `parse_status`/`parse_error`/`parsed_at`/`parse_model_version`/`parse_schema_version`), status CHECK, success-implies-payload CHECK, partial index on unfinished parses — additive, `db push`, no reset |
| 13 | `20260810120000_allow_multiple_profiles_per_user.sql` | drops UNIQUE on `profiles.user_id` (a user may own several profiles); adds a plain `user_id` index — `db push`, no reset |
| 14 | `20260810140000_user_delete.sql` | admin-only `users_delete` policy; `leads.user_id` made nullable + `ON DELETE SET NULL`, `job_profile_states.user_id` `ON DELETE SET NULL` (deleting a user removes only the user + comments; leads/states/profiles unlink) — `db push`, no reset |
| 15 | `20260810150000_bd_manager_access.sql` | `is_bd_manager()` helper; `users_select` widened so BD Managers can read the team roster (view-only — updates/deletes/invites stay admin-only) — `db push`, no reset |
| 16 | `20260810160000_bd_manager_full_access.sql` | widens business-table RLS so BD Managers mirror Admins everywhere except user management: `is_bd_manager()` added to profiles / profile_cvs / job_profile_matches / job_profile_states / leads / job_comments_update policies; `users` policies unchanged (roster read + own-name edit only, invites/management stay Admin-only) — `db push`, no reset |
| 17 | `20260810170000_leads_profile_owner.sql` | leads ownership follows the PROFILE, not the creation-time snapshot: `leads_select` / `leads_update` owner branch widened to the profile's current assigned user (`exists profiles p where p.id = profile_id and p.user_id = auth.uid()`), snapshot branch kept for the original applier — so leads created by an admin, or whose applier was deleted/reassigned, still land on the assigned developer — `db push`, no reset |
| 18 | `20260811055143_add_parsed_data_to_jobs.sql` | Adds `jobs.parsed_data` jsonb (`IF NOT EXISTS` — the column had already been added manually on the dev database during feature work, so the migration had to be safe against both a fresh and an already-patched DB) |
| 19 | `20260811120000_manual_jobs.sql` | seeds the `Manual` scraper (idempotent — only when no `Manual` row exists); `jobs_insert` RLS policy pinning `organization_id` to the caller's own `users` row, so any org member can add a job by hand — `db push`, no reset |
| 20 | `20260812000000_guard_last_active_admin.sql` | `guard_last_active_admin()` trigger on `users` (BEFORE UPDATE OR DELETE) — a hard DB-level guarantee that an org can never be left with zero active Admins, regardless of how the write is issued (app convention, direct DB write, or cascade) |
| 21 | `20260812010000_audit_logs.sql` | `audit_logs` — the security/team-management trail (login, password_set, invite_sent, user_updated, user_deleted), written by `lib/api/audit.ts`'s `logAudit()`; append-only through RLS (no update/delete policy), reads Admin-only |
| 22 | `20260812100000_multi_tenant_rls_scoping.sql` | `current_org_id()` / `is_admin_in(org)` / `is_privileged_in(org)` helpers; re-scopes every business-table policy (previously admissible to any Admin/BD Manager regardless of org) to the caller's own organization — closes a cross-tenant read/write hole ahead of a second organization ever existing |
| 23 | `20260812110000_trim_rls_to_tenant_tables.sql` | Revokes the seed's blanket `authenticated` CRUD grant; disables RLS on the 4 pure-catalog tables (`roles`, `pipeline_stages`, `seniority_level`, `scrapers`) and on `organizations`/`cron_run_locks` (no authenticated access), replacing it with per-table grants matching what the app actually issues — RLS stays the boundary only on genuinely tenant-scoped tables |
| 24 | `20260812120000_close_anon_grants.sql` | Revokes all `anon` privileges on every public table (defense-in-depth — RLS already masked them, but a table with a residual `anon` grant is one `disable row level security` away from exposure) and sets default privileges so future tables don't re-inherit `anon` access |
| 25 | `20260813075322_user_activities.sql` | `user_activities` — the product's business-activity feed (profiles/jobs/leads/comments/discovery), deliberately separate from `audit_logs`'s Admin-only security trail; visible org-wide to Admin/BD Manager, self-only to everyone else; append-only enforced by grants (no update/delete/truncate to `authenticated`) AND a BEFORE UPDATE/DELETE/TRUNCATE trigger (`prevent_user_activity_mutation()`) so not even `service_role` can rewrite history |

> Rows 11 and 18 (`drop_job_comments_parent_id`, `add_parsed_data_to_jobs`) were previously missing from this table entirely — a pre-existing documentation gap unrelated to this update, found and fixed while adding row 25. Rows 20–24 were added to the codebase by a separate PR (multi-tenant RLS scoping, the audit log, and the last-admin guard) and were likewise undocumented here until now.

---

## 3. Table catalog

### 3.1 `organizations`

The company/tenant scope for every business entity.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL |
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
| created_at | timestamptz | NOT NULL, default `now()` |

### 3.3 `users` — old DB: `profiles`

Authenticated users (staff: admins and BD executives). One row per Supabase auth user.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| role_id | uuid | FK → `roles(id)` ON DELETE SET NULL — nullable, at most one role |
| full_name | text | NOT NULL |
| email | text | NOT NULL, UNIQUE |
| is_active | boolean | NOT NULL, default `true` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

**Why `id` references `auth.users`:** accounts are created by Admin via the Supabase invite flow (no self-signup). A user row can only exist for an authenticated identity.

**Role model:** a user has **at most one role**, held directly on `users.role_id` (1:N roles → users). The old `user_roles` M:N join table was **not** re-created. Deleting a role nulls the reference but keeps the user (`ON DELETE SET NULL`).

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
| user_id | uuid | FK → `users(id)` — nullable; a user may own several profiles |
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

**Key rule:** a user can own **multiple** profiles (the UNIQUE on `user_id` was dropped in migration 12), while each profile still belongs to at most one user — `user_id` is a single FK per row. Reassignment is a single update of this column, and the same user may be assigned to several profiles. The old `engineer_bd_assignments` join/history table was **not** re-created (see §5).

### 3.7 `profile_cvs` — old DB: `engineer_cvs`

CVs attached to a profile. A profile can have **multiple** CVs; files live in a Storage bucket, this table holds the metadata.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| storage_path | text | NOT NULL — Cloudinary CDN URL for uploaded CVs; seeded rows carry dummy paths |
| file_name | text | NOT NULL |
| file_type | text | NOT NULL |
| file_size_bytes | bigint | NOT NULL |
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
| | | UNIQUE (`scraper_id`, `external_job_id`) |

The `UNIQUE (scraper_id, external_job_id)` constraint prevents duplicate ingest of the same posting.

**Manually added jobs** (the Pipeline page's "New Job" flow, POST `/api/jobs`) reuse this table: `scraper_id` points at the seeded `Manual` scraper (the typed source text lives on `parsed_data.source`), `external_job_id` is a random uuid the scrapers can never produce — so the AI cron's upsert (keyed on `scraper_id` + `external_job_id`) can never collide with or overwrite them. `is_globally_open` is set `true` at insert so the job surfaces in everyone's Discovery; the chosen profile's `job_profile_states` row carries the applied/dismissed state and the applied-on date (`created_at`), and every other profile has no row at all = suggested. `apply_url` is `''` when no URL was given. The manual extras (skills, budget, exp. compensation, source, developer) live on `parsed_data` — the `ParsedJobData` type in `lib/ai/client.ts` gained optional `budget` / `source` / `developer` fields for them.

### 3.11 `leads` — old DB: `leads`

**A lead is an applied job that received an employer reply.** It carries the pipeline position of that reply.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| job_id | uuid | NOT NULL, FK → `jobs(id)` |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` |
| job_profile_state_id | uuid | FK → `job_profile_states(id)` — added in migration 4 |
| user_id | uuid | nullable, FK → `users(id)` ON DELETE SET NULL — owner snapshot (null once the applier's account is deleted; the lead stays with the profile) |
| pipeline_stage_id | uuid | NOT NULL, FK → `pipeline_stages(id)` |
| applied_at | timestamptz | NOT NULL, default `now()` |
| last_activity_at | timestamptz | NOT NULL, default `now()` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |
| notes | text | NOT NULL, default `''` — Applier's Notes |

**Owner semantics:** `user_id` is a permanent snapshot taken at lead creation (who applied); it does not move if the profile is later reassigned. But **access follows the profile** (migration 16): the lead's owner for RLS and the app layer is the profile's CURRENT assigned user (`profiles.user_id`), with the snapshot kept as an additional read branch so the original applier keeps visibility after a reassignment. Leads created by an Admin/BD Manager on behalf of a profile, or whose applier's account was deleted (snapshot NULLed), still land on the developer assigned to the profile.

**Applier's Notes:** `notes` is writable by the profile's current assigned user plus Admin / BD Manager (`canManageLeadNotes`); the creation-time snapshot may still read (RLS) but edits follow the profile. Status/stage changes are allowed for the owner or an admin.

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

**Permissions:** any authenticated user of the job's org can read and comment (RLS `job_comments_select`/`insert` in migration 10 + the app's org gate). Edits are author-only; deletes are author-or-admin (moderation). Comments are org-scoped end-to-end, matching every other business table.

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

**No `updated_at` / `deleted_at`** — append-only by design, not an oversight (see `user_activities` below for the same divergence, spelled out in full). **Permissions:** insert is any org member, scoped to their own `organization_id` (migration 22's `current_org_id()`); select is Admin-only (`is_admin_in(organization_id)`) — this is the team-management trail, not a general activity feed, so BD Managers do not see it (contrast with `user_activities`, which they do see org-wide).

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

**Append-only, enforced three ways (RLS alone cannot do this — `service_role` bypasses RLS entirely, and `TRUNCATE` bypasses RLS even for `authenticated`):**
1. No UPDATE/DELETE RLS policies for `authenticated`.
2. Grants: `authenticated` and `service_role` hold only `SELECT, INSERT` (the blanket `REVOKE ALL` first strips the `TRUNCATE` that default privileges hand out).
3. Triggers (`prevent_user_activity_mutation()`) that raise on UPDATE, DELETE, and TRUNCATE (a separate statement-level trigger for TRUNCATE, since it never fires row-level triggers) — these fire regardless of role, so this is the guarantee that actually holds even against the service-role key; 1 and 2 are defense in depth. Force-tested against `service_role`/`postgres` directly, not just `authenticated`.

**Permissions:** insert is bound to `user_id = auth.uid()` in the same org — one user can never forge an entry attributed to someone else. Select is `is_privileged_in(organization_id)` (Admin + BD Manager, org-wide) OR own rows (`user_id = auth.uid()`) — matching the spec that BD Managers get full visibility like Admins, while every other role sees only their own activity. Force-tested (SELECT scoping for all three roles, forged-attribution INSERT, cross-org INSERT) against the live database with simulated JWTs per role.

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

1. A user has at most one role (`users.role_id` nullable FK — no join table).
2. A profile has at most one assigned user (`profiles.user_id` FK); a user may own many profiles.
3. Exactly one live `job_profile_states` row per (job, profile) pair (partial unique index).
4. A job posting is unique per source (`UNIQUE (scraper_id, external_job_id)`).
5. A lead references the specific application attempt that received the reply.

---

## 5. Design decisions & reasoning

1. **Fresh database, old migrations removed.** The schema is heavily modified (dropped tables/columns, new tables), so the old history was removed instead of migrated.

2. **`users.id` = `auth.users.id`.** Accounts come from the Admin invite flow; a user row cannot exist without an authenticated identity.

3. **One role per user, held on `users.role_id`** (roles 1─N users). The old `user_roles` M:N join table was dropped — a user has exactly one role, so an assignment table bought nothing. Role deletion nulls `role_id` (user survives).

4. **A user can own multiple profiles; each profile belongs to at most one user** (`profiles.user_id` FK — the UNIQUE was dropped in migration 12 so a user isn't capped at one profile). This replaces the many-to-many `engineer_bd_assignments`: ownership is a single FK update, and the old table's only remaining value — which user used which profile to apply — is covered by `leads` (permanent `user_id` owner snapshot).

5. **Multiple CVs per profile** (`profile_cvs` 1:N). The old "one recommended CV" pointer is replaced by a per-application `cv_id`, so each application records exactly which CV was sent.

6. **`job_engineer_matches` split into two tables.** The old table conflated score, status, and a single recommended CV in one row locked to `unique(job, engineer)`. In the fresh design the AI scores **each CV of a profile against each job separately** (`job_profile_matches` — one row per job + profile + cv), because different CVs have different impact on the same job. Scores refresh freely on every cron run — no status to lock, so the old "only refresh while `suggested`" rule disappears.

7. **Application state is its own lifecycle table (`job_profile_states`), not a column.** It holds the current state of a job against a profile plus the metadata of each attempt: which user applied and which CV they chose after seeing the `job_profile_matches` scores. Keyed directly on `(job_id, profile_id)` — no link to a specific match row. Superseded attempts are soft-deleted; the live row is `deleted_at IS NULL` (partial unique index enforces one live row per pair). Re-application after a profile change = soft-delete the old attempt and insert a new one.

8. **`application_status` enum has exactly `suggested`, `dismissed`, `applied`.** Post-reply outcomes are handled by `leads` + `pipeline_stages`, not by this enum. `dismissed_reason` records why a pair was dismissed (drives the dismiss UX).

9. **A lead is created by the user from the Pipeline page** (POST `/api/leads` with the `(job, profile)` pair), wrapping an applied application: it pins the state row (`job_profile_state_id`), takes `applied_at` from the state row, and records the permanent owner snapshot (`user_id` = the profile's assigned user). **Duplicate-lead rule is enforced in the API** — at most one live lead per `(job, profile)` pair; the POST is idempotent and returns the existing lead.

10. **Soft delete everywhere.** History is preserved by rows marked `deleted_at`, never destroyed.

11. **RLS enabled on every table** with policies written (migration 6): reference tables readable by any authenticated user; users/profiles/leads scoped through profile ownership (`profiles.user_id`) and `is_admin()`; writes are admin-only except where a policy grants profile owners their own rows (profiles, `job_profile_states`). There are no SECURITY DEFINER write functions — the cron writes with the service-role key, which bypasses RLS. API-role grants are applied via `supabase/seed.sql`. Migration 13 adds the only delete policy (`users_delete`, admin-only) for the permanent user-deletion flow. Migration 14 adds `is_bd_manager()` and widens `users_select` so BD Managers can read the team roster. Migration 15 widens every business-table policy to admit `is_bd_manager()` — BD Managers mirror Admins on Profiles / Discovery / Pipeline / Leads / Statistics (view + write) — while `users_insert`/`users_delete` stay admin-only and `users_update` (migration 6 B4) lets them edit only their own `full_name`. Migration 16 re-keys the `leads` owner branch to the profile's current assigned user so ownership follows the profile (matching the Business Developer model "own data or data related to the profile they are assigned"), keeping the snapshot as an additional read branch.

12. **`organization_id` on every business table.** Enables multi-organization scoping from day one.

13. **`rate_expection` (spec) is `rate_expectation`** and **`possibaly_closed` → `possibly_closed`** — spec typos corrected to the old codebase's spellings.

14. **JWT carries `is_admin` / `user_role`.** `custom_access_token_hook()` (migration 5) reads `users.role_id` → `roles.name` and bakes the claims into issued tokens; `middleware.ts` / `getCachedIsAdmin()` read them locally. RLS still re-checks `is_admin()` live at query time — the claim is an app-layer convenience only.

15. **Comments are an open org-wide thread, not an owner-scoped record.** Unlike leads (owner snapshot) or notes (applier-only), any org member can read and comment on any of the org's jobs (`job_comments` RLS scopes by `organization_id`, not by `user_id`). Comments are **flat** — deliberately no `parent_id`/replies. The drawer surfaces the same thread for a job everywhere (Discovery, Pipeline, and Leads via `commentsJobId`), since a lead wraps the same job.

16. **RLS is org-scoped, not just role-scoped, since migration 22.** Before `multi_tenant_rls_scoping`, every business-table policy admitted "Admin or BD Manager" regardless of which org the row belonged to — correct for a single-tenant deployment, but a live cross-tenant leak the moment a second `organizations` row exists (an Admin in org A could read/write org B's data). `current_org_id()` (the caller's own org, fail-closed to NULL) and `is_admin_in(org)` / `is_privileged_in(org)` (role check ANDed with an org match) are the helpers every policy now composes from. Reference tables with identical rows for every org (`roles`, `pipeline_stages`, `seniority_level`, `scrapers`) were deliberately left unscoped and had RLS disabled entirely in favor of plain grants (migration 23) — scoping them would mean duplicating catalog rows per org for no security benefit.

17. **Two audit tables, split by audience, not one.** `audit_logs` (migration 21) is the security/team-management trail — logins, invites, member changes — and stays Admin-only to read, on purpose. `user_activities` (migration 25) is the product's business-activity feed — profiles, jobs, leads, comments, discovery — visible org-wide to Admin **and** BD Manager, matching the Business Developer permission model everywhere else. They were kept as separate tables specifically so that widening the feed's audience (as the product requires) could never widen access to the security trail (which must not). Both are append-only by construction — see §3.15/§3.16 for the three-layer enforcement (RLS, grants, and a mutation-blocking trigger that also covers `service_role` and `TRUNCATE`, neither of which RLS can reach).

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

## 7. Open questions

1. **`leads.job_profile_state_id` is nullable.** The old `leads.job_engineer_match_id` was NOT NULL. Every lead should have a state row — decide whether to enforce NOT NULL.
2. **`withdrawn` / `closed` are not in `application_status`.** Currently the post-reply flow lives entirely on `leads` + `pipeline_stages`. Add them to the enum if withdrawal/closure must be recorded as states.
3. **`jobs.is_globally_open`** is likely redundant with `remote_allowed_region = 'Worldwide'`. Confirm whether to keep, derive, or drop.
4. **`cron_run_locks` uses a uuid key with no seeded row.** The old table used text job-keys (`'discover-jobs'`) with a seeded lock row, so the mutex existed before the first run. With uuid + no seed, the app must select-or-insert the lock row. Consider reverting to text keys.
5. **`profiles.user_id` is nullable.** A profile may exist without a user, and a user may have zero profiles. Confirm the intended direction — specifically whether external candidates (no login) should still be representable.
6. **`users.organization_id` is NOT NULL.** An organization row must exist before any user/profile can be inserted. Addressed by the seed data (`seed.sql` creates the `Recurso Labs` organization).
7. **Duplicate-lead rule.** Enforced in the API (POST `/api/leads` returns the existing live lead for the pair). A partial unique index could harden it at the DB level later.
8. **Re-application atomicity.** When lead creation returns, updating/creating the `job_profile_states` row and the lead must be atomic — today mark-applied is a single table INSERT/UPDATE, so nothing spans tables yet. Remaining gap: `reassign` has no fresh equivalent yet (Phase 3 — profile reassignment is a plain `profiles.user_id` update today). POST `/api/jobs` (manual job creation) is the first multi-table write: job + state row + (for "lead" state) a lead, inserted sequentially — every failure-prone input (profile, Manual scraper, stage) is validated before the first insert, so a mid-flight failure is a transient DB error, but a transaction/RPC would still be the hardening move.
9. **Soft-deleted state rows referenced by leads.** A lead can point to a state row that is later soft-deleted — lead queries must not filter the joined state by `deleted_at IS NULL`.
10. **`rate_currency char(3)`** pads values with spaces in Postgres; comparisons need trimming. Inherited from the old schema — consider `text` + length check if it causes friction.
11. **`cv_id` cross-table integrity.** Nothing enforces that a `job_profile_matches.cv_id` or `job_profile_states.cv_id` belongs to the same profile as the row's `profile_id` — needs app-level validation (a composite FK doesn't fit cleanly).

---

## 8. Seed data & not yet built

**Seed data** — reference and demo data for a fresh database:

| Source | What it seeds |
|---|---|
| `supabase/seed.sql` (runs automatically on `supabase db reset` via `[db.seed]` in `config.toml`) | Data-API grants (`anon` read, `authenticated`/`service_role` full + enum usage), `Recurso Labs` organization, `Admin`/`User` roles, seniority levels (`Lead`/`Senior`/`Mid`/`Junior`), pipeline stages (`Applied` → `Closed`; the frontend reads these dynamically, so their names/order are the UI source of truth — the last one is the terminal "done" stage), `Jsearch` scraper, 2 profiles (`Saad Mumtaz`, `Hashir Rehman`), 1 CV for each profile (dummy paths), 2 jobs (YO AI Labs, Mercor). Idempotent — fixed UUIDs + `ON CONFLICT DO NOTHING` |
| `scripts/createUser.cjs` (`npm run seed:user`) | The admin auth user (Fareed Zafar) via the service-role admin API — auth identities cannot be created from SQL — plus the matching `users` row with a single `Admin` role via `users.role_id`, and links the `Saad Mumtaz` profile to the user (ownership). Idempotent; requires migrations + `seed.sql` applied first |

**Not yet built:**

- The old leads module — the static `LeadsTab` is the current UI; a fresh leads module will be built against this schema when real data lands
- CV file storage — CVs are uploaded to Cloudinary (raw assets, `profiles/<profileId>/` folder) and `profile_cvs.storage_path` holds the CDN secure URL; seeded rows carry dummy paths until real files are uploaded through the app
