# Technical Implementation Plan

*AI-Powered Sales & BD Automation Platform*



> Stack: Next.js (App Router) + Supabase (Postgres, Auth, Storage) + Cron + LLM provider (TBD)  

> MVP build scope: Modules 1–4 only (Auth, Engineer Profiles, Job Discovery, Lead Management)  

> Modules 5–9 designed into the database now, built in Phase 2 — included below for planning continuity  

> Companion to: Database Architecture Review, Final Table Catalog  

> Status: Draft for review — sequencing and scope subject to sign-off  


---


## 1. Stack Recap & Architecture Summary


| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend + Backend | Next.js App Router | Server Actions / Route Handlers for backend logic — no separate backend service for v1. |
| Database + Auth + Storage | Supabase | Postgres DB, built-in Auth (Module 1), Storage (CVs/attachments), RLS for the "BD only sees their engineers" rule. |
| Scheduled jobs | Cron (nightly) | pg_cron + Edge Function, or Vercel Cron hitting a Route Handler — either works. Must be idempotent (safe to re-run if it fails partway). |
| Job source integration | Single external job platform API (v1) | Indeed and LinkedIn have no free official search API (confirmed) — recommended MVP path is JSearch (free tier, explicit remote-job filter, aggregates Indeed/LinkedIn/Glassdoor postings). Built behind an internal adapter interface so a source can be swapped or added later (e.g. a paid Apify scraper for direct Indeed/LinkedIn coverage) without touching the rest of the module. |
| LLM / AI | TBD provider | Relevance scoring, note summarization, follow-up suggestions, CV recommendation, duplicate-detection assist. Evaluate free/low-cost tiers (Gemini, Groq, hosted open-source) before committing to a paid provider. Wrapped behind a single internal service so providers can be swapped without touching feature code. |
| Notifications (email) | TBD (e.g. Resend/Postmark via Supabase) | Only needed once Module 7 ships; in-app notifications can ship first without this. |


### High-level request flow


```
Browser (Next.js pages)
   |
   v
Next.js Server Actions / Route Handlers  <---- Cron (Vercel or pg_cron) nightly discovery trigger
   |                     |
   v                     v
Supabase Postgres     Job Source Adapter  ---->  External Job Platform API
(RLS-enforced)              |
   |                        v
   |                  AI Service Wrapper  ---->  LLM Provider (TBD)
   v
Supabase Storage (CVs, lead files)
```




### Guiding principles


- No separate backend service for v1 — Server Actions/Route Handlers call Supabase directly (via the server-side client) and the two external integrations (job platform, LLM) through their respective adapter/wrapper modules.

- Every external integration point is wrapped: job_source adapters implement one interface; the AI service wrapper is the only code that calls the LLM provider directly. Nothing else in the codebase should import a provider SDK directly.

- Cron jobs are idempotent by construction — re-running a partially-failed nightly job must not create duplicate jobs, duplicate matches, or duplicate notifications. This is enforced by the DB constraints already in the schema (unique keys on jobs, job_engineer_matches), not by extra application-side bookkeeping.

- RLS is the access-control boundary, not the Server Action. Server Actions run as the authenticated user’s Supabase session (not a service-role bypass) wherever the operation is a normal user-facing read/write, so a bug in a Server Action can’t leak data across BD users.

- Service-role key usage is restricted to: the nightly cron job (needs to write jobs/matches across all engineers) and the auth-trigger-adjacent admin operations. Anything reachable from a logged-in user’s request uses the RLS-scoped client.


## 2. Suggested Project Structure


```
app/
  (auth)/
    login/
    reset-password/
  (dashboard)/
    engineers/
      [engineerId]/
    discovery/
    leads/
      [leadId]/
    reports/
    admin/
      job-sources/
      pipeline-stages/
      users/
  api/
    cron/
      discover-jobs/route.ts        (nightly job discovery trigger)
    webhooks/                        (future: email delivery callbacks, etc.)
lib/
  supabase/
    server.ts                       (server-side client, user-scoped)
    admin.ts                        (service-role client, cron/admin-only)
    middleware.ts
  job-sources/
    types.ts                        (JobSourceAdapter interface)
    indeed-adapter.ts
    registry.ts                     (loads active job_sources rows, maps to adapters)
  ai/
    client.ts                       (single LLM provider wrapper)
    relevance-scoring.ts
    summarization.ts
    follow-up-suggestions.ts
    cv-recommendation.ts
    duplicate-detection.ts
  actions/
    engineers.ts                    (Server Actions)
    leads.ts
    reminders.ts
    ...
  validation/
    schemas.ts                      (zod schemas shared by forms + actions)
components/
  ...
```



This mirrors the module boundaries below directly — each module’s Server Actions live in their own file under lib/actions/, and the two integration points (job sources, AI) are isolated in their own directories so provider/source swaps stay contained.


## 3. Build Sequencing & MVP Scope


> **Confirmed MVP scope**
>
> Modules 1–4 (Authentication, Engineer Profile Management, AI-Powered Job Discovery, Lead Management) are what gets built and shipped in this release. Modules 5–9 are designed into the database now — see the Database Architecture Review and Final Table Catalog, both of which already include their tables — but are not built as working features until Phase 2. This document covers both so the Phase 2 build has a plan waiting for it, but nothing past Module 4 should be scheduled into the current sprint/release.



| Release | Modules | Why this order |
| --- | --- | --- |
| Phase 1 (MVP — this release) | Module 1 (Auth) → Module 2 (Engineer Profiles) → Module 3 (Job Discovery) → Module 4 (Lead Management) | Strict dependency chain: nothing works without login and roles; discovery needs an engineer roster to match against; leads need discovered/matched jobs to convert from. |
| Phase 2 (post-MVP — later release) | Module 5 (Pipeline Tracking) + Module 6 (Timeline) together, then Module 7 (Notifications), then Module 8 (Reporting) | Pipeline and Timeline are built together because lead_events is the shared backbone for both. Notifications and Reporting need a working pipeline to have anything meaningful to act on. |
| Cross-cutting, started in Phase 1, deepened in Phase 2 | Module 9 (AI Capabilities) | Relevance scoring ships with Module 3 in the MVP. Summarization, follow-up suggestions, and CV recommendation are enhancements layered onto Modules 4–6 once Phase 2 builds the screens that would use them. |


## 4. Module 1 — Authentication & User Management (MVP)



#### Scope (MVP)


- Individual logins for Admin and BD Executive roles (no shared accounts). Admin-only account creation via invite — see below.

- Password reset via Supabase Auth’s built-in flow.

- Login history recorded per sign-in.

- Role-based route access (Admin-only sections vs. BD Executive sections), backed by roles/user_roles tables rather than a fixed field, per team decision.


#### Frontend


- app/(auth)/login — Supabase Auth UI or custom form calling supabase.auth.signInWithPassword.

- app/(auth)/reset-password — Supabase’s password-reset email flow.

- app/(dashboard)/admin/users — Admin-only screen to invite a new user (name, email, role picker).

- Root layout middleware checks session + role (via is_admin()), redirects unauthenticated users to /login and gates /admin/* routes to Admin only.


#### Backend


- lib/supabase/middleware.ts — refreshes the session cookie on every request (standard Supabase SSR pattern).

- Server Action or client-side call immediately after successful sign-in inserts a login_history row (client-initiated insert against the RLS-scoped client is fine here since a user can only insert their own row).

- inviteUser(email, fullName, roleId) — Admin-only Server Action. Calls Supabase’s admin invite-by-email API (creates the auth.users row and emails a password-setup link), then inserts one user_roles row for the selected role once the invite succeeds.

- Database trigger (from the schema doc) auto-creates the profiles row on auth.users insert — no app code needed for that step.


#### Tables involved


- profiles, roles, user_roles, login_history


#### Dependencies


None — this is the first module built.


#### Acceptance criteria


- A BD Executive cannot see or reach any /admin route.

- Password reset email flow works end-to-end using Supabase’s default template.

- A login_history row appears after every successful sign-in.

- Inviting a user creates exactly one user_roles row matching the role Admin selected — no user is ever left with zero roles or more than the one assigned.


## 5. Module 2 — Engineer Profile Management (MVP)



#### Scope (MVP)


- Admin creates/edits engineers with core details (skills, seniority, location, rate expectations).

- Multiple CVs per engineer, versioned, never overwritten.

- Enable/disable a profile (disabled = excluded from discovery).

- Assign engineers to one or more BD Executives; reassignment preserves historical lead visibility.


#### Frontend


- app/(dashboard)/engineers — list view, scoped automatically by RLS (Admin sees all, BD sees only assigned).

- app/(dashboard)/engineers/[engineerId] — profile detail: core fields, skills multi-select, CV list with upload + "current" indicator, assignment history panel (Admin-only edit, everyone can view relevant history).


#### Backend (Server Actions)


- createEngineer, updateEngineer, setEngineerActive — Admin-only, enforced both by RLS and a role check in the action.

- uploadEngineerCv — validates mime type/size against app_settings before generating a signed upload URL for the cv-files bucket; inserts the engineer_cvs row; DB trigger flips is_current.

- assignEngineerToBd / unassignEngineerFromBd — closes the current engineer_bd_assignments row (sets unassigned_at) and opens a new one; wrapped in a single DB function/transaction so the two never happen out of sync.


#### Tables involved


- engineers, skills, engineer_skills, seniority_levels, engineer_cvs, engineer_bd_assignments, app_settings


#### Dependencies


Module 1 (roles must exist to assign engineers to BD users).


#### Acceptance criteria


- A BD Executive’s engineer list only ever contains currently-assigned engineers.

- Uploading a new CV never deletes or overwrites a prior one; the CV list shows full history with the current one flagged.

- Reassigning an engineer to a different BD does not remove that engineer’s historical leads from the original BD’s lead list.


## 6. Module 3 — AI-Powered Job Discovery (MVP)



#### Scope (MVP)


- Single external job platform integration, behind an adapter interface — recommended MVP source: JSearch (free tier, explicit remote-job filter, aggregates listings originally from LinkedIn/Indeed/Glassdoor). Final source pick pending confirmation; swapping sources later only means writing a new adapter and adding a job_sources row.

- Remote-only discovery: the adapter is configured to request remote/work-from-home listings only (e.g. JSearch’s work_from_home=true), and each job’s remote status and eligibility region (jobs.is_remote, jobs.remote_region) are stored so this can be double-checked at insert time, not just trusted from the source.

- Nightly (cron-triggered) discovery run: fetch postings, score relevance per active engineer, store as job_engineer_matches.

- BD-facing discovery feed sorted by relevance score; dismiss action with reason.


#### Job source adapter interface


```
// lib/job-sources/types.ts
interface JobSourceAdapter {
  sourceSlug: string;
  fetchListings(params: { since?: Date }): Promise<RawJobListing[]>;
}
 
interface RawJobListing {
  externalId: string;
  title: string;
  companyName: string;
  location?: string;
  description?: string;
  applyUrl: string;
  postedAt?: Date;
}
```



registry.ts reads active rows from job_sources and picks the matching adapter by slug. Adding LinkedIn/Wellfound later means writing one new adapter file and inserting one job_sources row — nothing else in the module changes.


#### Nightly cron job design


1. Route handler at app/api/cron/discover-jobs/route.ts, triggered by Vercel Cron (or a pg_cron job calling an Edge Function that hits this route) once nightly.

1. For each active job_sources row: call the adapter’s fetchListings(), upsert into jobs on (job_source_id, external_job_id) — the existing unique constraint makes this a safe upsert, not an insert-then-check.

1. Compute dedup_hash for each new job row (normalized title+company+location).

1. For each active engineer, call the AI relevance-scoring service against newly discovered jobs (or all undismissed jobs, depending on volume) and upsert job_engineer_matches on (job_id, engineer_id) — again, the unique constraint makes re-running safe.

1. Log a summary (jobs fetched, matches created, errors) — no partial-failure cleanup needed because every write is idempotent by constraint; a re-run after a crash simply continues/overwrites safely.


#### Frontend


- app/(dashboard)/discovery — per-BD feed of job_engineer_matches for their assigned engineers, sorted by relevance_score DESC, with a Dismiss action (captures dismissed_reason) and an Apply Now button linking to jobs.apply_url.


#### Tables involved


- job_sources, jobs, job_engineer_matches


#### Dependencies


Module 2 (need an engineer roster and skills/summary content to score against).


#### Acceptance criteria


- Re-running the nightly job twice in a row (simulating a retry) produces no duplicate jobs or matches.

- A disabled engineer receives no new matches.

- Adding a second job source requires no changes outside lib/job-sources/.


## 7. Module 4 — Lead Management (MVP)



#### Scope (MVP)


- BD marks a match "Applied" (manual application on the real platform; our system just records it).

- Duplicate prevention: at most one active-or-closed lead per (engineer, job); reapplication only allowed after a prior lead was withdrawn.

- BD searches/filters their own leads; Admin sees everyone’s.

> **Scope boundary vs. Module 5/6**
>
> MVP’s lead detail page shows status only — Applied, Withdrawn, or Closed. There is no stage-by-stage tracker (Assessment Received, Tech Interview 1, etc.) and no scrollable history view in this release; those are Module 5 and Module 6, built in Phase 2. What MVP does do quietly, so nothing is lost later: leads.current_stage_id is set to "Applied" by default (the pipeline_stages table already exists), and one lead_events row is logged automatically when a lead is created — so Phase 2’s screens will have real history to display from day one instead of starting empty.


#### Frontend


- app/(dashboard)/leads — list with filters (engineer, status, date range); scoped automatically by RLS.

- app/(dashboard)/leads/[leadId] — lead detail: status, key dates, a link back to the job posting. No stage stepper, notes, files, or reminders yet — those arrive with Modules 5–7.

- "Mark Applied" button on a discovery match card — calls the markMatchApplied Server Action.


#### Backend (Server Actions)


- markMatchApplied(matchId) — calls the create_lead_from_match() DB function. The function itself rejects a duplicate via the partial unique constraint; the Server Action surfaces that as a friendly "already applied" message rather than a raw constraint error.

- withdrawLead(leadId) — sets status = withdrawn, logs a lead_events row; this is what re-opens the (engineer, job) pairing for a future re-application.

- searchLeads(filters) — straightforward filtered query; RLS handles the ownership scoping so the query itself doesn’t need a manual bd_user_id filter for correctness (though adding one is a reasonable defense-in-depth / performance measure).


#### Tables involved


- leads, job_engineer_matches, jobs, engineers


#### Dependencies


Module 3 (leads originate from matches in MVP).


#### Acceptance criteria


- Attempting to mark the same engineer+job Applied twice (without a withdrawal in between) is blocked with a clear message, not a database error leaking to the UI.

- Withdrawing a lead and reapplying to the same job for the same engineer succeeds and creates a new lead row.

- A BD Executive’s lead search never returns another BD’s leads.


## 8. Module 5 — Interview Pipeline Tracking (Phase 2 — Post-MVP)


> **Not part of the current build**
>
> Included here for planning continuity — the database (pipeline_stages, lead_files) already supports this module, but the screens and Server Actions below are not built until Phase 2.


#### Scope (MVP)


- Configurable, ordered pipeline stages (not hardcoded).

- At every stage: notes, files, a date, and a follow-up reminder.

- An engineer can be in multiple pipelines (leads) at once.


#### Frontend


- Stage stepper component on the lead detail page, rendered from the live pipeline_stages table (ordered by order_index) — never a hardcoded list in the component.

- "Advance stage" action opens a form for note/file/date/reminder, all optional except the target stage.

- app/(dashboard)/admin/pipeline-stages — Admin CRUD for the stage list (add/reorder/deactivate).


#### Backend (Server Actions)


- advanceLeadStage(leadId, stageId, note?, occurredAt?) — thin wrapper around the advance_lead_stage() DB function, which updates leads.current_stage_id and inserts the lead_events row atomically.

- attachLeadFile(leadId, file, leadEventId?) — uploads to the lead-files bucket, inserts lead_files row.

- Admin-only: createPipelineStage, reorderPipelineStages, deactivatePipelineStage.


#### Tables involved


- pipeline_stages, leads, lead_events, lead_files


#### Dependencies


Module 4 (needs leads to attach stage progress to).


#### Acceptance criteria


- Changing the stage list in Admin settings is reflected immediately in the stage stepper with no deploy.

- An engineer with two simultaneous leads shows independent stage progress on each without cross-contamination.


## 9. Module 6 — Lead Timeline & Activity Log (Phase 2 — Post-MVP)


> **Not part of the current build**
>
> The lead_events table is already being written to automatically in MVP (Module 4 logs an "Applied" entry). Phase 2 adds the actual screen to browse that history — nothing structural changes, this is purely a new read-only view.


#### Scope (MVP)


- Append-only, chronological audit trail per lead: discovered, applied, stage changes, notes, files, feedback — all in one place.

- No editing or deleting history; corrections are new entries.


#### Frontend


- Timeline component on the lead detail page — renders lead_events ordered by occurred_at, joined to lead_event_types for the icon/label and to pipeline_stages when populated.


#### Backend


- No dedicated Server Actions beyond what Modules 4–5 and 7 already write — this module is primarily the read path (getLeadTimeline(leadId)) plus the RLS/grant setup that makes lead_events genuinely append-only (no UPDATE/DELETE policy exists for any non-service role).


#### Tables involved


- lead_events, lead_event_types


#### Dependencies


Built alongside Module 5 — they share the same underlying table.


#### Acceptance criteria


- There is no UI path, and no granted database permission, that lets any user edit or delete an existing lead_events row.

- Every write from Modules 4, 5, and 7 produces a corresponding timeline entry — nothing changes a lead’s state silently.


## 10. Module 7 — Notifications & Follow-Up Reminders (Phase 2 — Post-MVP)


> **Not part of the current build**
>
> lead_reminders and notifications tables exist in the schema now; the reminder form, the due-reminder sweep, and the notification inbox described below are built in Phase 2.


#### Scope (MVP)


- BD sets reminders tied to a lead/stage, including recurring reminders.

- In-app notification when a reminder is due; proactive flag for leads gone quiet too long.

- Admin sees overdue items across the whole team.

- Email notifications deferred — in-app ships first.


#### Frontend


- Reminder form on the lead detail page — date/time, message, optional recurrence interval.

- Notification bell/inbox reading from notifications, scoped to the current user by RLS.

- app/(dashboard)/admin — team-wide overdue leads view (Admin-only query directly against leads/lead_reminders, not through another user’s notification feed).


#### Backend


- createReminder(leadId, message, remindAt, recurrenceInterval?) — straightforward insert with the CHECK constraint already guarding recurrence consistency.

- Cron job (can share the same nightly trigger infrastructure as Module 3, or run more frequently, e.g. hourly): sweep lead_reminders WHERE status = ‘pending’ AND remind_at <= now(); for each due reminder, insert a notifications row for the lead’s owner, and either mark status = completed (one-time) or advance remind_at by recurrence_interval and leave status = pending (recurring).

- Same or a companion cron sweep flags leads where last_activity_at is older than a configurable threshold (another app_settings entry, e.g. stale_lead_days) and inserts an overdue-style notification.


#### Tables involved


- lead_reminders, notifications, app_settings


#### Dependencies


Modules 4–5 (reminders and staleness are meaningless without leads and stage history to hang off).


#### Acceptance criteria


- A recurring reminder, once actioned, reschedules itself rather than requiring the BD to manually recreate it.

- The reminder sweep is safe to run twice for the same due reminder (no duplicate notifications) — guarded by checking status = pending before acting, inside a transaction.

- Admin’s overdue view surfaces stale/overdue items across all BD users, not just their own.


## 11. Module 8 — Reporting & Dashboards (Phase 2 — Post-MVP)


> **Not part of the current build**
>
> No new tables required — this module is just organized queries against data Modules 1–4 are already collecting. Deferred only because stage/reminder data from Modules 5–7 makes the reporting far more useful once it exists.


#### Scope (MVP)


- BD Executive view: own active leads by stage.

- Admin view: platform-wide numbers (total engineers, active leads, applications/interviews/offers per period).

- Filtering by engineer, BD user, date range; CSV export.


#### Frontend


- app/(dashboard)/reports — stage-grouped lead counts (BD view) or platform-wide metrics (Admin view), same route, different query scope driven by RLS + role.

- CSV export via a Route Handler that streams a CSV response from the same filtered query used for the on-screen view, rather than a separate export-specific query path.


#### Backend


- Plain aggregate SQL queries (COUNT/GROUP BY) against leads and lead_events, using the indexes already defined in the schema (bd_user_id+status, current_stage_id, last_activity_at). No materialized views needed at MVP volume.


#### Tables involved


- leads, lead_events, engineers, pipeline_stages (read-only, aggregate queries)


#### Dependencies


Modules 4–5 (nothing to report on before leads and stages exist).


#### Acceptance criteria


- CSV export matches exactly what’s on screen for the same filter set.

- Report queries return in acceptable time at expected MVP data volumes without a materialized view.


## 12. Module 9 — AI Capabilities (MVP: scoring only; deeper features Phase 2)


> **What ships in MVP vs. later**
>
> Only relevance scoring (feeding job_engineer_matches in Module 3) is part of the current build. Note summarization, follow-up suggestions, CV recommendation, and "needs attention" flagging all depend on Phase 2 screens (Modules 5–7) to display or act on them, so they ship alongside those modules — the AiClient interface below is designed for all of them up front so no rework is needed when they’re switched on.

Not a screen of its own — a set of capabilities layered into Modules 3–6, all routed through one internal AI service wrapper so the underlying provider can change without touching feature code.


#### AI service wrapper


```
// lib/ai/client.ts
interface AiClient {
  scoreRelevance(engineerProfile: EngineerContext, job: JobListing): Promise<{ score: number; modelVersion: string }>;
  summarizeNotes(notes: string[]): Promise<string>;
  suggestFollowUp(leadContext: LeadContext): Promise<string>;
  recommendCv(engineerId: string, job: JobListing): Promise<{ cvId: string; reasoning: string }>;
  detectDuplicateJob(candidate: JobListing, existing: JobListing[]): Promise<{ isDuplicate: boolean; matchId?: string }>;
}
// A single provider-specific implementation (Gemini/Groq/etc.) satisfies this interface.
// Every other module imports only the interface, never the provider SDK directly.
```



| Capability | Lands with | Where it writes |
| --- | --- | --- |
| Relevance scoring | Module 3 (nightly cron) | job_engineer_matches.relevance_score, ai_model_version |
| Duplicate detection (same-source) | Module 3 | jobs.dedup_hash comparison; enforced via DB unique constraint for exact duplicates |
| Note summarization | Module 6 enhancement | lead_events.ai_summary (generated on demand or async after a long note is added) |
| Follow-up suggestions | Module 5/7 enhancement | Surfaced in the UI on the lead detail page; not persisted for MVP unless a caching need emerges |
| CV recommendation | Module 3/4 enhancement | job_engineer_matches.recommended_cv_id |
| "Needs attention today" flagging | Module 7 | Computed on demand from last_activity_at, relevance_score, and reminder due dates — not persisted (see Architecture Review, Section 21) |



> **Provider evaluation**
>
> Evaluate free/low-cost tiers (Google Gemini, Groq, or a hosted open-source model) before committing to a paid provider. Because every call goes through the AiClient interface, this evaluation can happen — and be revisited — without any change to Modules 3–7.

Principle carried through every AI capability: AI surfaces and suggests; BD clicks and decides. No auto-apply, no silent state changes driven by AI output alone — every AI-influenced write (a match, a recommendation, a flag) is something a human acts on, not something the system acts on unattended.


## 13. Deployment & Environment


- Frontend + Server Actions/Route Handlers deploy to Vercel (or equivalent Next.js host).

- Supabase project provides Postgres, Auth, and Storage — no separate database host needed.

- Environment separation: separate Supabase projects (or at minimum separate schemas/keys) for staging and production, so the nightly discovery cron and AI calls in staging never touch production data or burn production API quota.

- Secrets (Supabase service-role key, job platform API key, LLM provider key) live in Vercel/Supabase environment variables, never in client-exposed code.

- Cron trigger: if using Vercel Cron, configure in vercel.json to hit /api/cron/discover-jobs on schedule; if using pg_cron, schedule a call to a Supabase Edge Function that then calls the same Route Handler (or reimplements the logic in the Edge Function directly) — pick one to avoid maintaining the discovery logic twice.


## 14. Open Technical Decisions


| Decision | Status |
| --- | --- |
| Job platform for v1 | Recommended: JSearch (free, remote-filter built in). Official Indeed/LinkedIn APIs confirmed unavailable at any price outside enterprise partnerships — awaiting your final go-ahead to lock this in. |
| remote_region normalization | Currently free text on jobs, filled by AI from the job description. Revisit as a proper lookup table once real data shows the values are clean/consistent enough to normalize. |
| LLM provider for v1 | TBD — evaluate free/low-cost tiers first (Gemini, Groq, hosted open-source). |
| Cron mechanism | Vercel Cron vs. pg_cron + Edge Function — either works; pick based on ops preference, not a functional difference. |
| Email provider | TBD, needed only once Module 7’s email piece is prioritized — in-app notifications ship without it. |
| Manual lead creation | Deferred per the schema design — revisit once AI discovery is live and its coverage/gaps are known. |
