# Final Table Catalog

*MVP + Future — AI-Powered Sales & BD Automation Platform*



> Reflects: internal-tool-forever, reapplication only after withdrawal,  

> roles stored as a table (not an enum) per team decision, remote-region targeting on jobs,  

> cross-platform dedup deferred but seamed-in, per-lead ownership, recurring reminders,  

> configurable CV limits.  

> Status: FINAL — approved for migration  


---


## Part A — MVP Tables



### 1. profiles


App-level identity extension of auth.users. Role is no longer stored here — see roles / user_roles below.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK, FK → auth.users(id) ON DELETE CASCADE |
| full_name | text | NO |  |
| email | text | NO | UNIQUE, synced from auth.users via trigger |
| is_active | boolean | NO | true — Admin can deactivate a login without deleting history |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

Rules: auto-created by after-insert trigger on auth.users, triggered when Admin invites a new user (see Account Creation Flow below). is_active is Admin-writable only.




### 2. roles (lookup)


Replaces the earlier user_role enum, per team decision — so a new role can be added by Admin later without a migration.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| name | text | NO | UNIQUE (e.g. 'admin', 'bd_executive') |
| description | text | YES |  |
| created_at | timestamptz | NO | now() |

MVP seed: two rows — admin and bd_executive. Adding a future role (e.g. "BD Manager") is an INSERT here, not a schema change.




### 3. user_roles


Assigns roles to people. Modeled as many-to-many so a person could hold more than one role later, even though MVP only ever assigns one.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| user_id | uuid | NO | FK → profiles(id) ON DELETE CASCADE |
| role_id | uuid | NO | FK → roles(id) ON DELETE RESTRICT |
| assigned_at | timestamptz | NO | now() |
| assigned_by | uuid | YES | FK → profiles(id) — null only for the first seeded admin |

Unique: (user_id, role_id) — no duplicate identical assignments. Indexes: user_id, role_id.

> **How this changes RLS**
>
> Every RLS policy that used to check profiles.role = ‘admin’ now checks EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = ‘admin’), wrapped in the same is_admin() helper function so no policy code actually changes — only what’s inside that one function.




### Account Creation Flow (confirms who creates a BD login, and how)


- Only Admin can create a new account — there is no public/self-service signup.

- Admin submits the new person’s name, email, and role from an internal screen. The Server Action calls Supabase’s admin invite-by-email API, which creates the auth.users row and emails the person a secure link to set their own password.

- That auth.users insert fires the existing trigger, which creates the matching profiles row automatically.

- The same Server Action then inserts one user_roles row for the role Admin selected at invite time.

- Nobody — including Admin — ever sees or sets another person’s password. The invited person sets it themselves via the emailed link.




### 4. login_history


Append-only sign-in log.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK, gen_random_uuid() |
| user_id | uuid | NO | FK → profiles(id) |
| logged_in_at | timestamptz | NO | now() |
| ip_address | inet | YES |  |
| user_agent | text | YES |  |

Indexes: (user_id, logged_in_at DESC). Rules: INSERT/SELECT only — no UPDATE/DELETE grants to any app role.




### 5. seniority_levels (lookup)


| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| name | text | NO | UNIQUE (e.g. "Mid-level") |
| rank | smallint | NO | UNIQUE — sort order |
| is_active | boolean | NO | true |
| created_at | timestamptz | NO | now() |

Rules: Admin-managed; seeded with Junior/Mid/Senior/Lead but extensible without migration.




### 6. skills (lookup)


| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| name | text | NO | UNIQUE |
| created_at | timestamptz | NO | now() |

Indexes: UNIQUE (lower(name)) — prevents "React" vs "react" duplicates.




### 7. engineers


Core engineer roster.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| full_name | text | NO |  |
| email | text | NO | UNIQUE |
| phone | text | YES |  |
| location | text | YES |  |
| seniority_level_id | uuid | NO | FK → seniority_levels(id) |
| years_experience | numeric(4,1) | YES | CHECK ≥ 0 |
| rate_expectation | numeric(10,2) | YES | CHECK ≥ 0 |
| rate_currency | char(3) | NO | 'USD' |
| summary | text | YES | free text used as AI matching input |
| is_active | boolean | NO | true — false = hidden from discovery |
| created_by | uuid | NO | FK → profiles(id) |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

Indexes: is_active, seniority_level_id. Rules: never hard-deleted. is_active=false stops discovery inclusion only — all history stays intact.




### 8. engineer_skills (junction)


| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| engineer_id | uuid | NO | FK → engineers(id) ON DELETE CASCADE |
| skill_id | uuid | NO | FK → skills(id) ON DELETE RESTRICT |
| proficiency | smallint | YES | CHECK between 1 and 5 |

PK: (engineer_id, skill_id). Index: skill_id (reverse lookup — "who has skill X").




### 9. engineer_cvs


Versioned CV history — never overwritten.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| engineer_id | uuid | NO | FK → engineers(id) |
| label | text | NO | e.g. "Backend-focused" |
| storage_path | text | NO | UNIQUE |
| file_name | text | NO |  |
| mime_type | text | NO | CHECK IN allowed list |
| file_size_bytes | integer | NO | CHECK (0 < x ≤ 10485760) — 10MB hard ceiling |
| is_current | boolean | NO | true — flipped by trigger on new insert |
| uploaded_by | uuid | NO | FK → profiles(id) |
| created_at | timestamptz | NO | now() |

Indexes: partial (engineer_id) WHERE is_current. Rules: append-only — no UPDATE/DELETE.

> **Configurable limits**
>
> The 10MB CHECK is a hard DB-level safety net. The real, tunable limit (e.g. default 5MB) lives in app_settings and is enforced by the upload Edge Function — so Admin can tighten/loosen it without a migration, while the DB still refuses anything absurd.




### 10. engineer_bd_assignments


Time-ranged engineer↔BD assignment history — the table that makes reassignment safe.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| engineer_id | uuid | NO | FK → engineers(id) |
| bd_user_id | uuid | NO | FK → profiles(id) |
| assigned_by | uuid | NO | FK → profiles(id) |
| assigned_at | timestamptz | NO | now() |
| unassigned_at | timestamptz | YES | NULL = currently active |

Constraints: CHECK (unassigned_at IS NULL OR unassigned_at > assigned_at). Unique: partial (engineer_id, bd_user_id) WHERE unassigned_at IS NULL. Indexes: partial (bd_user_id)/(engineer_id) WHERE unassigned_at IS NULL.

Rules: reassignment = close old row (unassigned_at = now()) + insert new row. Never mutate a closed row. Supports "one or more BD per engineer" natively.




### 11. app_settings


Small config table so limits/tunables aren’t hardcoded.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| key | text | NO | PK |
| value | jsonb | NO |  |
| description | text | YES |  |
| updated_at | timestamptz | NO | now() |

Seed rows: cv_max_file_size_bytes → 5242880; cv_allowed_mime_types → ["application/pdf", "application/msword", ...]. jsonb is appropriate here — operational config, not relational business data.




### 12. job_sources (lookup)


Configurable platform registry — explicitly required to not be hardcoded.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| name | text | NO | UNIQUE |
| slug | text | NO | UNIQUE |
| base_url | text | YES |  |
| is_active | boolean | NO | true |
| config | jsonb | YES | source-specific settings (API keys reference, scrape config) |
| created_at | timestamptz | NO | now() |

MVP: one seeded row. Adding a second platform later is an INSERT, not a migration.




### 13. jobs


One row per discovered posting (per source).

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| job_source_id | uuid | NO | FK → job_sources(id) |
| external_job_id | text | NO | source's native ID |
| title | text | NO |  |
| company_name | text | NO | free text for MVP — see companies in Part B |
| location | text | YES |  |
| description | text | YES |  |
| apply_url | text | NO | the redirect link surfaced in the dashboard |
| is_remote | boolean | YES | populated from the source’s own remote flag (e.g. JSearch’s work_from_home result); nullable since not every source reports it reliably |
| remote_region | text | YES | best-effort eligibility label (e.g. "US only", "Worldwide", "EMEA"), filled by AI reading the job description; blank if undetermined |
| posted_at | timestamptz | YES |  |
| discovered_at | timestamptz | NO | now() |
| dedup_hash | text | YES | normalized title+company+location hash |
| created_at | timestamptz | NO | now() |

Unique: (job_source_id, external_job_id). Indexes: dedup_hash, is_remote.

> **Why remote_region is free text, not a lookup table (for now)**
>
> Eligibility region is usually buried in unstructured description text, not a clean field from the source. Normalizing it into a proper regions lookup table only pays off once real data shows the values are clean and consistent enough to normalize — building a strict structure on top of messy free text now would add complexity without adding accuracy. Revisit as a lookup table (regions + job_regions) if/when that holds true.

> **Future seam**
>
> This is the exact hook for cross-platform dedup — see canonical_jobs in Part B. Nothing here needs to change structurally when a second source is added; the merge logic bolts on via a new nullable FK column.




### 14. job_engineer_matches


AI-generated candidate pairing + relevance score.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| job_id | uuid | NO | FK → jobs(id) |
| engineer_id | uuid | NO | FK → engineers(id) |
| relevance_score | numeric(5,2) | NO | CHECK 0–100 |
| ai_model_version | text | NO |  |
| status | enum(match_status) | NO | 'suggested' \| dismissed \| applied |
| dismissed_reason | text | YES |  |
| recommended_cv_id | uuid | YES | FK → engineer_cvs(id) |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

Unique: (job_id, engineer_id) — one AI suggestion per pairing, ever. Indexes: (engineer_id, relevance_score DESC), job_id.

Rules: a match can be reused across multiple leads over time (e.g. withdraw → reapply).




### 15. pipeline_stages (lookup)


Configurable ordered stage list — explicitly required to not be hardcoded.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| name | text | NO | UNIQUE |
| order_index | smallint | NO | UNIQUE |
| is_terminal | boolean | NO | false |
| is_active | boolean | NO | true |
| created_at | timestamptz | NO | now() |

MVP seed: Applied → Assessment Received → Assessment Submitted → HR Interview → Tech Interview 1 → Tech Interview 2 → Client Interview → Offer Received → Offer Accepted/Rejected → Closed (order_index 1–10, last three is_terminal = true).




### 16. leads


The core application record. Ownership is a permanent snapshot; duplicate prevention lives here.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| job_id | uuid | NO | FK → jobs(id) |
| engineer_id | uuid | NO | FK → engineers(id) |
| job_engineer_match_id | uuid | NO | FK → job_engineer_matches(id) — traceability to the AI suggestion |
| bd_user_id | uuid | NO | FK → profiles(id) — permanent owner, does not move on reassignment |
| current_stage_id | uuid | NO | FK → pipeline_stages(id), defaults to "Applied" |
| status | enum(lead_status) | NO | 'active' \| withdrawn \| closed |
| applied_at | timestamptz | NO | now() |
| last_activity_at | timestamptz | NO | now() — maintained by trigger from lead_events |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

> **Duplicate-prevention rule**
>
> Unique: partial (job_id, engineer_id) WHERE status <> ‘withdrawn’. At most one active-or-closed lead per engineer+job at a time. Once a lead is withdrawn, that slot frees up and a new lead can be created for the same pairing. "closed" (rejected, offer outcomes, etc.) blocks reapplication permanently.

Indexes: (bd_user_id, status), current_stage_id, last_activity_at.

Rules: created only via create_lead_from_match() — never a bare INSERT, so the duplicate check and initial lead_events row can’t be skipped. job_engineer_match_id is NOT NULL for MVP; becomes nullable later if manual lead entry is added, with no other structural change needed since job_id/engineer_id are already stored directly.




### 17. lead_event_types (lookup)


Why a lookup and not an enum: the AI feature list will keep adding event kinds — a lookup table lets that happen via INSERT, not a migration.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| code | text | NO | UNIQUE (stage_changed, note_added, file_added, reminder_set, ai_flagged, discovered, dismissed, ...) |
| label | text | NO |  |
| created_at | timestamptz | NO | now() |




### 18. lead_events


Append-only audit trail / timeline per lead.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| lead_id | uuid | NO | FK → leads(id) |
| event_type_id | uuid | NO | FK → lead_event_types(id) |
| stage_id | uuid | YES | FK → pipeline_stages(id) — populated only for stage_changed events |
| note | text | YES |  |
| ai_summary | text | YES | cached AI-generated summary of the note, if any |
| occurred_at | timestamptz | NO | now() |
| created_by | uuid | NO | FK → profiles(id) |
| created_at | timestamptz | NO | now() |

Indexes: (lead_id, occurred_at). Rules: append-only — RLS grants INSERT/SELECT only.




### 19. lead_files


| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| lead_id | uuid | NO | FK → leads(id) |
| lead_event_id | uuid | YES | FK → lead_events(id) |
| storage_path | text | NO | UNIQUE |
| file_name | text | NO |  |
| mime_type | text | NO |  |
| file_size_bytes | integer | NO | CHECK > 0 |
| uploaded_by | uuid | NO | FK → profiles(id) |
| created_at | timestamptz | NO | now() |

Indexes: lead_id.




### 20. lead_reminders


Follow-up reminders, one-time or recurring.

| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| lead_id | uuid | NO | FK → leads(id) |
| message | text | NO |  |
| remind_at | timestamptz | NO |  |
| is_recurring | boolean | NO | false |
| recurrence_interval | interval | YES | e.g. '7 days' |
| status | enum(reminder_status) | NO | 'pending' \| completed \| dismissed |
| created_by | uuid | NO | FK → profiles(id) |
| completed_at | timestamptz | YES |  |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

Check: (is_recurring = false) OR (recurrence_interval IS NOT NULL). Indexes: partial (status, remind_at) WHERE status = ‘pending’.

Rules: a fired recurring reminder is actioned by advance_reminder(), which pushes remind_at forward and resets status to pending in place, rather than spawning new rows indefinitely.




### 21. notifications


| Column | Type | Null | Default / Notes |
| --- | --- | --- | --- |
| id | uuid | NO | PK |
| user_id | uuid | NO | FK → profiles(id) |
| lead_id | uuid | YES | FK → leads(id) |
| type | text | NO | reminder_due \| overdue_lead \| new_high_match |
| title | text | NO |  |
| body | text | YES |  |
| is_read | boolean | NO | false |
| created_at | timestamptz | NO | now() |

Indexes: (user_id, is_read).




## Part B — Future Tables (not built now)



### canonical_jobs + jobs.canonical_job_id — Phase 2, triggered by adding a second job platform


Groups postings of the same real-world role across sources (e.g. one opening on Indeed, LinkedIn, and Wellfound) so duplicate-prevention and relevance scoring operate on the real job, not the per-source posting.

- canonical_jobs(id uuid PK, title text, company_name text, created_at timestamptz)

- jobs.canonical_job_id uuid NULL FK → canonical_jobs(id) — added as a nullable column; existing rows stay NULL until AI/fuzzy matching backfills them.

> **Migration path when platform #2 is added**
>
> Add the nullable column and table (non-breaking), run AI similarity matching to populate canonical_job_id, then change the leads duplicate-prevention partial unique index from (job_id, engineer_id) to (canonical_job_id, engineer_id). This is exactly why jobs.dedup_hash already exists in MVP.


### companies


Normalize jobs.company_name once company-level reporting or relationship tracking is needed (e.g. "we’ve placed 4 engineers at Acme"). Not needed while company_name is just descriptive text on a job posting.


### ai_insights (generic AI-output cache)


If follow-up-message suggestions or CV-fit explanations outgrow single-column caches (job_engineer_matches.recommended_cv_id, lead_events.ai_summary) and need their own lifecycle, this becomes a generic polymorphic table (entity_type, entity_id, insight_type, content, generated_at). Premature for MVP.


### audit_log (system-wide)


Track sensitive non-lead actions — engineer field edits, profile enable/disable, pipeline-stage/job-source config changes — beyond what lead_events and engineer_bd_assignments already capture implicitly. Build with the same append-only-via-RLS pattern once there is a concrete need, not speculatively.


### Manual lead creation support


If, once AI discovery is live, BD should also be able to log a lead without a prior match — this is a single-column change: make leads.job_engineer_match_id nullable. job_id/engineer_id are already first-class columns on leads, so no other structural change is needed.


### Team / manager hierarchy


A third role (e.g. "BD Manager") is only worth building when that role actually exists. Two roles today; don’t build scaffolding for a role that doesn’t exist yet.


### saved_reports / materialized rollups


Introduce once dashboard queries against leads/lead_events start showing up as slow in practice. Current MVP volume is well served by the indexes in Part A.
