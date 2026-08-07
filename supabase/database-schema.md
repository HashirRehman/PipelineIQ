# PipelineIQ — Fresh Database Schema

The database schema for the redesigned PipelineIQ platform. It replaces the old database, which was removed from the repository (`supabase/migrations/` now contains only the fresh history). All migrations run against a fresh Supabase project via the Supabase CLI.

- **Migrations:** 10 · **Tables:** 13 · **Status:** schema + seed data + RLS policies + helper/transition functions all in place
- **Workflow:** `npm run migrate:new -- <name>` → edit SQL → `npm run migrate:up` (see README)
- **Last updated:** 2026-08-07

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
| 3 | `20260806150000_jobs_leads.sql` | `jobs`, `leads` |
| 4 | `20260806160000_job_matches_and_states.sql` | `application_status` enum, `job_profile_matches`, `job_profile_states`, `leads.job_profile_state_id` FK |
| 5 | `20260806190000_custom_access_token_hook.sql` | `custom_access_token_hook()` (JWT `is_admin` / `user_role` claims) |
| 6 | `20260806200000_rls_policies_and_helpers.sql` | `is_admin()` + RLS policies for all 13 tables |
| 7 | `20260806210000_discovery_functions.sql` | `job_profile_states.dismissed_reason`, `upsert_job_profile_match()`, `apply_job_profile()` |
| 8 | `20260806220000_cron_lock_and_auth_triggers.sql` | seeds the `cron_run_locks` row; cron/auth trigger hardening |
| 9 | `20260806230000_security_and_constraint_hardening.sql` | trigger helper `search_path`; `profiles.user_id` FK `ON DELETE SET NULL`; `profile_cvs` MIME/size/unique-storage-path constraints |
| 10 | `20260806240000_discovery_actions_by_job_profile.sql` | discovery actions (mark-applied / dismiss) keyed on `(job_id, profile_id)` pairs |

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
| user_id | uuid | UNIQUE, FK → `users(id)` — nullable |
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

**Key rule:** `user_id UNIQUE` makes user↔profile strictly 1:1 — a BD (user) can have **at most one** profile assigned at a time. Reassignment is a single update of this column. The old `engineer_bd_assignments` join/history table was **not** re-created (see §5).

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
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

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

### 3.11 `leads` — old DB: `leads`

**A lead is an applied job that received an employer reply.** It carries the pipeline position of that reply.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | NOT NULL, FK → `organizations(id)` |
| job_id | uuid | NOT NULL, FK → `jobs(id)` |
| profile_id | uuid | NOT NULL, FK → `profiles(id)` |
| job_profile_state_id | uuid | FK → `job_profile_states(id)` — added in migration 4 |
| user_id | uuid | NOT NULL, FK → `users(id)` — owner snapshot |
| pipeline_stage_id | uuid | NOT NULL, FK → `pipeline_stages(id)` |
| applied_at | timestamptz | NOT NULL, default `now()` |
| last_activity_at | timestamptz | NOT NULL, default `now()` |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

**Owner semantics:** `user_id` is a permanent snapshot taken at lead creation; it does not move if the profile is later reassigned to another BD.

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
| user_id | uuid | FK → `users(id)` — nullable (system suggestions) |
| cv_id | uuid | FK → `profile_cvs(id)` — nullable (CV chosen for the application) |
| dismissed_reason | text | nullable — set when the pair is dismissed |
| created_at / updated_at | timestamptz | NOT NULL, default `now()` |
| deleted_at | timestamptz | |

**Key rule:** the live state per `(job, profile)` pair is the row with `deleted_at IS NULL`, enforced by a partial unique index (`job_id, profile_id WHERE deleted_at IS NULL`). Superseded attempts are soft-deleted, so the which-user-which-CV history stays queryable — no `is_current` column.

---

## 4. Relationships

```
organizations 1─N users
organizations 1─N profiles
organizations 1─N jobs
organizations 1─N leads

auth.users 1─1 users
roles 1─N users                (users.role_id — at most one role per user)
users 1─1 profiles            (profiles.user_id UNIQUE)
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
```

### Invariants

1. A user has at most one role (`users.role_id` nullable FK — no join table).
2. A user has at most one profile at a time (`profiles.user_id` UNIQUE).
3. Exactly one live `job_profile_states` row per (job, profile) pair (partial unique index).
4. A job posting is unique per source (`UNIQUE (scraper_id, external_job_id)`).
5. A lead references the specific application attempt that received the reply.

---

## 5. Design decisions & reasoning

1. **Fresh database, old migrations removed.** The schema is heavily modified (dropped tables/columns, new tables), so the old history was removed instead of migrated.

2. **`users.id` = `auth.users.id`.** Accounts come from the Admin invite flow; a user row cannot exist without an authenticated identity.

3. **One role per user, held on `users.role_id`** (roles 1─N users). The old `user_roles` M:N join table was dropped — a user has exactly one role, so an assignment table bought nothing. Role deletion nulls `role_id` (user survives).

4. **User↔profile is strictly 1:1** (`profiles.user_id UNIQUE`), replacing the many-to-many `engineer_bd_assignments`. Business rule: a BD has at most one profile assigned at a time. Reassignment is a single FK update; the old table's only remaining value was history, and that history is now covered by `leads` (which records which user used which profile to apply). Profiles that never generate an application have no historical requirement.

5. **Multiple CVs per profile** (`profile_cvs` 1:N). The old "one recommended CV" pointer is replaced by a per-application `cv_id`, so each application records exactly which CV was sent.

6. **`job_engineer_matches` split into two tables.** The old table conflated score, status, and a single recommended CV in one row locked to `unique(job, engineer)`. In the fresh design the AI scores **each CV of a profile against each job separately** (`job_profile_matches` — one row per job + profile + cv), because different CVs have different impact on the same job. Scores refresh freely on every cron run — no status to lock, so the old "only refresh while `suggested`" rule disappears.

7. **Application state is its own lifecycle table (`job_profile_states`), not a column.** It holds the current state of a job against a profile plus the metadata of each attempt: which user applied and which CV they chose after seeing the `job_profile_matches` scores. Keyed directly on `(job_id, profile_id)` — no link to a specific match row. Superseded attempts are soft-deleted; the live row is `deleted_at IS NULL` (partial unique index enforces one live row per pair). Re-application after a profile change = soft-delete the old attempt and insert a new one.

8. **`application_status` enum has exactly `suggested`, `dismissed`, `applied`.** Post-reply outcomes are handled by `leads` + `pipeline_stages`, not by this enum. `dismissed_reason` records why a pair was dismissed (drives the dismiss UX).

9. **A lead exists only for applied jobs that received an employer reply.** It pins the specific application attempt (`job_profile_state_id`) and tracks the pipeline stage. `user_id` is the permanent owner snapshot. Created atomically by `apply_job_profile()` (migration 7), which also supersedes any prior live lead for the same (job, profile) pair — duplicate-lead rule.

10. **Soft delete everywhere.** History is preserved by rows marked `deleted_at`, never destroyed.

11. **RLS enabled on every table** with policies written (migration 6): reference tables readable by any authenticated user; users/profiles/leads scoped through profile ownership (`profiles.user_id`) and `is_admin()`; writes are admin-only unless a SECURITY DEFINER function (discovery RPCs) handles them. API-role grants are applied via `supabase/seed.sql`.

12. **`organization_id` on every business table.** Enables multi-organization scoping from day one.

13. **`rate_expection` (spec) is `rate_expectation`** and **`possibaly_closed` → `possibly_closed`** — spec typos corrected to the old codebase's spellings.

14. **JWT carries `is_admin` / `user_role`.** `custom_access_token_hook()` (migration 5) reads `users.role_id` → `roles.name` and bakes the claims into issued tokens; `middleware.ts` / `getCachedIsAdmin()` read them locally. RLS still re-checks `is_admin()` live at query time — the claim is an app-layer convenience only.

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
| `engineer_bd_assignments` | dropped (1:1 ownership on `profiles.user_id`) |
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
7. **Duplicate-lead rule.** `apply_job_profile()` soft-deletes any prior live lead for the (job, profile) pair before inserting the fresh snapshot — enforced in the function, not by a partial unique index. Confirm whether a DB-level constraint is also wanted.
8. **Re-application atomicity.** `apply_job_profile()` updates/creates the `job_profile_states` row and the lead in one transaction — the old `reassign_engineer_bd` guarantee. Remaining gap: `reassign` has no fresh equivalent yet (Phase 3 — profile reassignment is a plain `profiles.user_id` update today).
9. **Soft-deleted state rows referenced by leads.** A lead can point to a state row that is later soft-deleted — lead queries must not filter the joined state by `deleted_at IS NULL`.
10. **`rate_currency char(3)`** pads values with spaces in Postgres; comparisons need trimming. Inherited from the old schema — consider `text` + length check if it causes friction.
11. **`cv_id` cross-table integrity.** Nothing enforces that a `job_profile_matches.cv_id` or `job_profile_states.cv_id` belongs to the same profile as the row's `profile_id` — needs app-level validation (a composite FK doesn't fit cleanly).

---

## 8. Seed data & not yet built

**Seed data** — reference and demo data for a fresh database:

| Source | What it seeds |
|---|---|
| `supabase/seed.sql` (runs automatically on `supabase db reset` via `[db.seed]` in `config.toml`) | Data-API grants (`anon` read, `authenticated`/`service_role` full + enum usage), `Recurso Labs` organization, `Admin`/`User` roles, seniority levels (`Lead`/`Senior`/`Mid`/`Junior`), pipeline stages (`New Lead` → `Rejected`), `Jsearch` scraper, 2 profiles (`Saad Mumtaz`, `Hashir Rehman`), 1 CV for each profile (dummy paths), 2 jobs (YO AI Labs, Mercor). Idempotent — fixed UUIDs + `ON CONFLICT DO NOTHING` |
| `scripts/createUser.cjs` (`npm run seed:user`) | The admin auth user (Fareed Zafar) via the service-role admin API — auth identities cannot be created from SQL — plus the matching `users` row with a single `Admin` role via `users.role_id`, and links the `Saad Mumtaz` profile to the user (1:1 ownership). Idempotent; requires migrations + `seed.sql` applied first |

**Not yet built:**

- The old leads module — the static `LeadsTab` is the current UI; a fresh leads module will be built against this schema when real data lands
- CV file storage — CVs are uploaded to Cloudinary (raw assets, `profiles/<profileId>/` folder) and `profile_cvs.storage_path` holds the CDN secure URL; seeded rows carry dummy paths until real files are uploaded through the app
