# Database Architecture Review

*AI-Powered Sales & BD Automation Platform*



> Status: FINAL — approved for migration  

> Scope: Single-tenant, internal tool  

> Includes: roles stored as a table (team decision), remote-region job targeting  


---


## 1. Database Architecture Summary


The domain breaks into five clusters that map cleanly to the product modules:

- Identity — auth.users (Supabase-managed) + profiles (app-level identity/metadata) + roles / user_roles (role assignment) + login_history.

- Engineer inventory — engineers, skills (+ junction), engineer_cvs, engineer_bd_assignments.

- Discovery — job_sources, jobs, job_engineer_matches (AI relevance scoring lives here).

- Lead lifecycle — pipeline_stages, leads, lead_events (append-only timeline), lead_files, lead_reminders.

- Notifications — notifications.


### Design principles applied throughout


- No comma-separated or JSON-stuffed relational data. Skills, platforms, and stages are normalized tables, not arrays or JSON blobs, because they need to be filtered, joined, and reported on.

- History is preserved by append-only tables and validity windows, not by mutation. CVs are never overwritten, engineer→BD assignment changes are timestamped ranges, and lead progress is a log of events, not a single mutable status column.

- Configurability is data, not code. Pipeline stages and job sources are rows an Admin can edit, not hardcoded enums or app constants.

- UUID primary keys everywhere, timestamptz for all time columns, created_at/updated_at only where mutation actually happens.

- RLS does the access-control heavy lifting, not application code — a BD Executive querying leads or engineers directly gets correctly-scoped rows even if the app layer has a bug.

> **Key architectural decision**
>
> A lead’s ownership is captured at creation time and does not move when an engineer is reassigned. leads.bd_user_id is a permanent snapshot; engineer_bd_assignments is the separate, time-varying table that controls new engineer visibility going forward. This is what lets a BD Executive keep visibility into their own historical leads after an engineer is reassigned to someone else.




## 2. Table Relationship Explanation


- auth.users 1:1 profiles — every app user has exactly one profile row, PK shared with auth.users.id.

- profiles N:M roles via user_roles — role is stored as a proper assignment table (per team decision), not a fixed column, so a new role can be added by Admin without a migration and a person could hold more than one role in the future.

- profiles 1:N login_history — audit of sign-ins.

- profiles (as BD) 1:N engineer_bd_assignments N:1 engineers — many-to-many between BD users and engineers, modeled as a history table, not a plain junction, because assignments change over time and must not be destroyed.

- engineers 1:N engineer_cvs — versioned, append-only.

- engineers N:M skills via engineer_skills.

- job_sources 1:N jobs — configurable platform list.

- jobs 1:N job_engineer_matches N:1 engineers — AI discovery output; one row per (job, engineer) candidate pairing.

- job_engineer_matches 1:0/1 leads — a match may graduate into a lead once BD marks it Applied.

- leads N:1 pipeline_stages (current stage); leads 1:N lead_events N:1 pipeline_stages (nullable) — current state vs. full history kept separate so "what stage is this lead in right now" is a cheap indexed lookup, not a derived aggregate.

- leads 1:N lead_files, leads 1:N lead_reminders.

- profiles 1:N notifications.


## 3. Text-Based ER Diagram


```
auth.users ──1:1── profiles ──1:N── login_history
                     |  |
                     |  ├──1:N── user_roles ──N:1── roles
                     |  |
                     |  └──1:N── engineer_bd_assignments ──N:1── engineers
                     |                                              |
                     |                                              ├──1:N── engineer_cvs
                     |                                              ├──N:M── skills (via engineer_skills)
                     |                                              ├──1:N── job_engineer_matches
                     |                                              └──1:N── leads
                     |
                     └──1:N── leads ──N:1── pipeline_stages
                                |  |
                                |  └──1:N── lead_events ──N:1── pipeline_stages (nullable)
                                ├──1:N── lead_files
                                └──1:N── lead_reminders
 
job_sources ──1:N── jobs ──1:N── job_engineer_matches ──0/1:1── leads
 
profiles ──1:N── notifications
```




## 4. MVP Tables


| # | Table | Cluster |
| --- | --- | --- |
| 1 | profiles | Identity |
| 2 | roles | Identity |
| 3 | user_roles | Identity |
| 4 | login_history | Identity |
| 5 | engineers | Engineer inventory |
| 6 | skills | Engineer inventory |
| 7 | engineer_skills | Engineer inventory |
| 8 | seniority_levels | Engineer inventory |
| 9 | engineer_cvs | Engineer inventory |
| 10 | engineer_bd_assignments | Engineer inventory |
| 11 | app_settings | Configuration |
| 12 | job_sources | Discovery |
| 13 | jobs | Discovery |
| 14 | job_engineer_matches | Discovery |
| 15 | pipeline_stages | Lead lifecycle |
| 16 | leads | Lead lifecycle |
| 17 | lead_event_types | Lead lifecycle |
| 18 | lead_events | Lead lifecycle |
| 19 | lead_files | Lead lifecycle |
| 20 | lead_reminders | Lead lifecycle |
| 21 | notifications | Notifications |



21 tables for a platform with this much surface area — not overbuilt; each one earns its place against a specific stated requirement.


## 5. Tables Postponed to Later Versions


| Table | Why postponed |
| --- | --- |
| companies | jobs.company_name is text for MVP. Normalizing into a companies table only pays off once you’re doing company-level reporting or CRM-style relationship tracking. |
| canonical_jobs / jobs.canonical_job_id | Cross-source duplicate detection is only relevant once a second job platform is added. MVP is single-source, so this is deferred — but jobs.dedup_hash is already in place as the input signal it will consume. |
| ai_insights (generic) | Follow-up suggestions, note summaries, and CV-fit recommendations are cached directly on the entities they relate to for MVP. A generic polymorphic AI-insights table adds complexity not needed until multiple insight types compete for the same UI surface. |
| Generic audit_log (system-wide) | Lead-specific history is fully covered by lead_events. A system-wide audit log for admin actions is good hygiene for v1.1, not required by the stated MVP scope. |
| BD team hierarchy / manager role | Only two roles exist today. Don’t build a third role or manager-scoping speculatively. |
| saved_reports / materialized views | v1 reporting is served fine by indexed queries against existing tables. Materialized views are a later performance optimization once real query patterns are known. |


## 6. Supabase Auth Integration


- auth.users remains the source of truth for credentials, password reset, and session management — use Supabase’s built-in flows, don’t reimplement password reset.

- profiles has id uuid primary key references auth.users(id) on delete cascade — a 1:1 extension table for app-specific fields (full_name, is_active). Role no longer lives here — see roles / user_roles.

- A trigger on auth.users (after insert) creates the matching profiles row automatically.

- login_history is populated from the client/edge function on successful sign-in, since Supabase Auth doesn’t fire a Postgres trigger on login by default. Don’t build directly on auth.audit_log_entries — it isn’t a stable public contract for app-level queries.


#### Account creation flow


- Only Admin can create an account — no public self-signup, matching the "no shared accounts" requirement.

- Admin submits name, email, and role from an internal screen. The Server Action calls Supabase’s admin invite-by-email API — this creates the auth.users row (firing the profiles trigger) and emails the person a secure link to set their own password.

- The same Server Action inserts one user_roles row for the role Admin selected. Nobody, including Admin, ever sees or sets another person’s password.


## 7. Row Level Security Strategy


RLS is enabled on every application table (never on auth.*, which Supabase already locks down). The core pattern is two SECURITY DEFINER helper functions that every policy composes from:

- is_admin() — checks EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = ‘admin’). Because this check is wrapped in one function, storing roles as a table instead of a profiles.role column required no changes to any RLS policy — only to what’s inside this one function.

- assigned_engineer_ids() — returns the set of engineer IDs currently assigned to auth.uid() (engineer_bd_assignments rows where unassigned_at IS NULL).

| Table | Policy logic |
| --- | --- |
| engineers | SELECT if is_admin() OR id IN assigned_engineer_ids(). No per-row owner column — visibility is derived from engineer_bd_assignments. |
| leads | SELECT/UPDATE if is_admin() OR bd_user_id = auth.uid(). Uses the permanent owner snapshot, not current assignment — this is what preserves historical visibility through reassignment. |
| job_engineer_matches / jobs | Visibility inherited transitively via the matched engineer’s current assignment. Admin sees all. |
| lead_events, lead_files, lead_reminders | Visibility inherited from the parent leads row via the same predicate, joined. |
| engineer_cvs | Same as engineers — visible to assigned BD + Admin. |
| profiles | A user can always read their own row; Admin reads all; BD users cannot read each other’s profile rows. |
| notifications | Strictly user_id = auth.uid() — even Admin doesn’t bypass this; the team-wide overdue view is a separate query against leads/lead_reminders. |


## 8. Admin Access Rules


Admin bypasses ownership filters on every table via is_admin() — full read on engineers, leads, jobs, job_engineer_matches; full read on all lead_events/files/reminders transitively. Admin can write to the configurable lookup tables (pipeline_stages, job_sources, skills, seniority_levels); BD Executives get read-only access to these for dropdowns/filtering.


## 9. Normal User (BD Executive) Access Rules


- Read/write on leads they own, and everything hanging off those leads (events, files, reminders).

- Read-only on engineers currently assigned to them (and cascading read on those engineers’ CVs, skills, matches).

- No visibility into engineers not assigned to them, even if a former assignment existed and was removed.

- Read-only on lookup tables (pipeline_stages, job_sources, skills, seniority_levels).

- Cannot see other BD users’ profiles, leads, or notifications.


## 10. Supabase Storage Bucket Structure


Two private buckets — no public bucket for anything containing candidate PII or client-specific assessment content:

```
cv-files/
  {engineer_id}/{cv_id}-{original_filename}
 
lead-files/
  {lead_id}/{lead_event_id}-{original_filename}
```



Keying by engineer_id/lead_id in the path is what makes storage RLS tractable — the policy checks access using the same helper functions as the table RLS, matched against the path prefix.


## 11. File Access Policies


- cv-files: allowed if is_admin() OR the {engineer_id} path segment is in assigned_engineer_ids().

- lead-files: allowed if is_admin() OR the {lead_id} path segment corresponds to a lead owned by auth.uid().

- Uploads go through the same policies (INSERT mirrors SELECT conditions) so a BD can’t upload into another BD’s lead folder.

- File metadata tables (lead_files, engineer_cvs) are the source of truth for filenames/labels/versioning; Storage just holds bytes at a path referenced by storage_path.


## 12. Recommended PostgreSQL Enums


Reserved for small, stable, code-coupled value sets unlikely to need runtime editing by an Admin:

- lead_status — active, withdrawn, closed

- match_status — suggested, dismissed, applied

- reminder_status — pending, completed, dismissed

> **Team decision: roles are a table, not an enum**
>
> user_role was originally proposed as an enum here. Per team decision, it’s now the roles + user_roles pair described in Section 2 (Table Relationship Explanation) instead — so Admin can add a new role later without a migration, and so a person could hold more than one role if that’s ever needed. This was a genuine judgment call, not a correction: two roles with one-per-person would have been a reasonable case for an enum too, but the team chose to build for the "new role added later" scenario now.


## 13. Values That Should Use Lookup Tables Instead


- roles — per team decision (see above): Admin can add a new role without a migration, and a person can hold more than one role.

- pipeline_stages — explicitly required to be configurable.

- job_sources — explicitly required to support adding platforms without a rebuild.

- skills — an open, growing vocabulary; an enum would require a migration for every new skill.

- seniority_levels — a small set today, but modeled as a lookup table since new levels (Staff, Principal) shouldn’t require a migration.

- lead_event_types — the AI feature roadmap implies this list will keep growing; a lookup table lets new event types ship as data, not migrations.


## 14. Required Database Triggers


- auth.users → profiles — auto-create profile row when Admin invites a new user (role assignment into user_roles happens in the same Server Action, not the trigger, since it needs to know which role Admin picked).

- engineer_cvs — on insert, unset is_current on the engineer’s prior CVs and set it on the new row.

- updated_at maintenance — standard before-update timestamp trigger on all mutable tables.

- leads.last_activity_at — updated whenever a lead_events row is inserted for that lead, so stale-lead detection is a plain indexed query.

- Duplicate-prevention enforcement on leads at insert time (engineer + job) — see Section 16.


## 15. Required Database Functions


- is_admin() — SECURITY DEFINER, used across nearly every RLS policy.

- assigned_engineer_ids() — SECURITY DEFINER, returns current engineer assignment set for auth.uid().

- create_lead_from_match(match_id) — validates no existing duplicate, creates the leads row, flips job_engineer_matches.status to applied, inserts the initial lead_events row, all in one transaction.

- advance_lead_stage(lead_id, new_stage_id, note, occurred_at) — validates the stage exists/is active, updates leads.current_stage_id, inserts the lead_events row, so a stage transition can never happen without a corresponding audit event.


## 16. Duplicate Prevention Strategy



#### Same job, same engineer, submitted twice


A partial unique constraint on leads (engineer_id, job_id) WHERE status <> ‘withdrawn’. This blocks a second active-or-closed lead for the same pairing while allowing a new lead once a prior one is withdrawn — matching the confirmed business rule that reapplication is only allowed after withdrawal, never after rejection or closure.


#### Same job posted twice from the same source


Unique constraint on jobs (job_source_id, external_job_id).


#### Same job posted across different sources (future)


A fuzzy, AI-driven problem rather than a constraint. MVP stores a dedup_hash (normalized title+company+location) on jobs with a non-unique index; the AI layer flags likely duplicates for BD to confirm. When a second platform is added, this becomes the input to a canonical_jobs grouping table (see Section 5 / future schema) — a non-breaking, additive migration.


## 17. Audit Log Strategy


lead_events is append-only by policy: RLS grants INSERT and SELECT but no UPDATE/DELETE to any non-superuser role, matching the requirement that corrections happen via new entries, not edits. login_history is append-only for the same reason. A broader system-wide audit log is deferred per Section 5.


## 18. Soft Delete, Archive, and Versioning Strategy


| Entity | Strategy |
| --- | --- |
| Engineers | Never hard-deleted. is_active=false stops discovery inclusion but preserves all history (CVs, leads, matches). |
| CVs | Never overwritten or deleted — pure append with an is_current flag. |
| Leads | Never deleted. lead_status moves to withdrawn/closed; the row and its full event history remain queryable forever. |
| Pipeline stages / job sources / skills | Soft-disabled via is_active rather than deleted, so historical leads referencing a retired stage still resolve. |
| Assignments | Never deleted — unassigned_at marks the end of a period rather than removing the row. |


## 19. Recommended Indexes


- user_roles(user_id) — the hot path for is_admin() and any future has_role() check

- user_roles(role_id)

- engineer_bd_assignments(bd_user_id) WHERE unassigned_at IS NULL (partial)

- engineer_bd_assignments(engineer_id) WHERE unassigned_at IS NULL (partial)

- engineers(is_active)

- engineer_skills(skill_id)

- engineer_cvs(engineer_id) WHERE is_current (partial)

- jobs(job_source_id, external_job_id) — unique

- jobs(dedup_hash)

- jobs(is_remote)

- job_engineer_matches(engineer_id, relevance_score DESC)

- job_engineer_matches(job_id)

- leads(bd_user_id, status)

- leads(current_stage_id)

- leads(last_activity_at)

- lead_events(lead_id, occurred_at)

- lead_reminders(remind_at) WHERE status = ‘pending’ (partial)

- notifications(user_id, is_read)


## 20. Reporting and Dashboard Query Considerations


The v1 asks (BD’s own leads by stage; Admin’s platform-wide counts; filter by engineer/BD/date; CSV export) are all satisfiable by indexed queries against leads + lead_events — no reporting-specific tables needed for MVP. leads.last_activity_at and leads.current_stage_id being plain indexed columns (rather than derived from the event log at query time) is what keeps these dashboard queries cheap. Materialized rollups become worth it only once real trend-reporting workloads emerge.


## 21. AI Data Architecture


- job_engineer_matches.relevance_score + ai_model_version — every score is traceable to the model version that produced it.

- job_engineer_matches.status = dismissed + dismissed_reason — the feedback-loop input for improving matching over time.

- job_engineer_matches.recommended_cv_id — covers CV-fit recommendation without a separate table.

- Interview note summarization is cached directly on the relevant lead_events row (ai_summary) rather than a separate table — a 1:1 enrichment of an existing row.

- "Needs attention today" flags (stalled, high-relevance new match, upcoming interview) are computed on demand from existing indexed columns, not persisted as a materialized flag that would go stale.


## 22. Future Scalability Risks


- Multi-tenancy retrofit — decided against for now (internal tool forever), so no organization_id scoping is needed. Documented here only because it was the single biggest fork in the design.

- jobs table growth — AI discovery across multiple platforms will generate rows quickly; monthly partitioning by discovered_at becomes worth considering past MVP volume.

- Free-text company_name on jobs — fine for single-platform MVP; entity resolution becomes a real problem once aggregating across sources, which is the trigger for the deferred companies table.

- lead_events as a single unbounded append-only table — the right design, but the fastest-growing table after jobs; index discipline matters most here.


## 23. Possible Security Risks


- RLS gaps on join tables — job_engineer_matches, lead_events, lead_files, lead_reminders all need policies that correctly chain back to the owning leads/engineers row; needs explicit test coverage per table.

- PII exposure via Storage — CVs and interview assessments leak badly if a bucket is accidentally public or a policy is too broad. Both buckets should be tested against a non-assigned BD user before launch.

- SECURITY DEFINER function scope creep — is_admin()/assigned_engineer_ids() run with elevated privilege by design; they should never become a shortcut to skip RLS elsewhere.

- login_history integrity — if ever used for security purposes (compromise detection), it needs to be genuinely append-only with no UPDATE/DELETE grants.


## 24. Resolved Business Rules (from stakeholder review)


| Question | Resolution |
| --- | --- |
| Multi-tenancy | Internal tool forever — no organization_id scoping required. |
| Re-application policy | Blocked permanently after rejection/closure; allowed again only if the prior lead was withdrawn. |
| Re-posted roles | A new posting for the same position is a new job row — no special handling needed. |
| Cross-platform duplicates | Deferred until a second platform is added; jobs.dedup_hash is the seam for the future canonical_jobs migration. |
| Manual lead creation | Undecided — MVP requires an AI match to create a lead; leads.job_engineer_match_id can be made nullable later without other structural change. |
| Ownership model | Per-lead ownership — each BD sees only their own leads, confirmed. |
| Reminders | Must support recurrence. |
| CV upload limits | Required — enforced via app_settings (configurable) with a DB-level hard ceiling as a safety net. |
| Roles storage | Stored as roles + user_roles tables rather than an enum, per team decision, so a new role can be added by Admin without a migration. |
| Remote job targeting | is_remote (boolean) plus remote_region (free text, AI-filled from the job description) on jobs. Region stays free text rather than a lookup table until real data proves clean enough to normalize. |
| Account creation | Admin-only, via Supabase invite-by-email. The invited person sets their own password; nobody else ever sees or sets it. |
