# CLAUDE.md

Persistent project context for Claude Code. Read this at the start of every session — it captures decisions that live in our planning docs, not in the code itself, so don't rediscover or second-guess them from scratch.

## What this project is

An internal platform (single-tenant, built for one company's own BD team — never multi-tenant) that centralizes engineer profiles, uses AI to discover matching jobs, and tracks every application from first contact to close. Full background: see `/docs` in this repo —
`01-database-architecture-review.md`, `02-final-schema-table-catalog.md`, `03-technical-implementation-plan.md`, `04-project-briefing-plain-english.md`.

## Stack

- **Frontend + backend**: Next.js (App Router). Server Actions / Route Handlers only — no separate backend service.
- **Database + Auth + Storage**: Supabase (Postgres, built-in Auth, Storage, RLS).
- **Scheduled jobs**: nightly cron (Vercel Cron or pg_cron + Edge Function) — must be idempotent.
- **Job source**: recommended MVP source is JSearch (free tier, explicit remote-job filter). Confirm before building if this hasn't been finalized yet.
- **LLM provider**: TBD — wrapped behind a single internal `AiClient` interface. Never call a provider SDK directly from feature code.

## Current build scope — read this before touching anything

**MVP = Modules 1–4 only**: Authentication & User Management, Engineer Profile Management, AI-Powered Job Discovery, Lead Management.

Modules 5–9 (Interview Pipeline Tracking, Lead Timeline & Activity Log, Notifications & Reminders, Reporting & Dashboards, deeper AI Capabilities) are **designed into the database already but not built yet.** Their tables exist (`pipeline_stages`, `lead_event_types`, `lead_events`, `lead_files`, `lead_reminders`, `notifications`) so nothing needs to be redesigned later — but don't build screens, Server Actions, or UI for them unless explicitly asked. If a task seems to require Module 5+ functionality, stop and ask rather than assuming it's in scope.

## Rules that must not be silently reinterpreted

- **Roles are tables, not an enum.** `roles` + `user_roles`, not a `role` column on `profiles`. This was a deliberate team decision — don't "simplify" it back to an enum.
- **RLS is the access-control boundary, not application code.** Every table has RLS enabled. `is_admin()` and `assigned_engineer_ids()` are the two SECURITY DEFINER helpers everything else composes from. Never write a query that relies on application logic alone to scope a BD Executive's visibility.
- **Duplicate-lead prevention**: at most one `active`/`closed` lead per (engineer, job) — enforced by a partial unique index, not application-side checking. A new lead for the same pairing is only allowed if the prior one is `withdrawn`.
- **Lead ownership is a permanent snapshot.** `leads.bd_user_id` never changes when an engineer is reassigned to a different BD. Don't "fix" this by deriving ownership from current assignment.
- **`lead_events` and `login_history` are append-only.** No UPDATE/DELETE grants, ever, for any non-service role. Corrections are new rows, not edits.
- **Job source access goes through `JobSourceAdapter`.** Never call JSearch/Adzuna/Apify APIs directly from a Server Action — write or extend an adapter, and route everything through `lib/job-sources/registry.ts`.
- **AI calls go through the `AiClient` interface** in `lib/ai/client.ts`. Same reasoning — provider swaps should never touch feature code.
- **Remote-region eligibility (`jobs.remote_region`) is free text, not a lookup table.** Don't normalize it into a `regions` table unless explicitly asked — the data isn't clean enough yet.
- **Account creation is Admin-only**, via Supabase's invite-by-email flow. Never build a self-signup path. Nobody, including Admin, ever sets another user's password directly.

## Working conventions

- UUID primary keys, `timestamptz` for all timestamps, `created_at`/`updated_at` only where a row is actually ever updated.
- Use Plan Mode (`Shift+Tab`) before any multi-file change — lay out the approach, wait for approval, then execute.
- Migrations before features: when starting a new module, write/verify the relevant SQL migration first, get it reviewed, then build the Server Actions and UI on top.
- Build in this order: Module 1 → 2 → 3 → 4. Don't jump ahead or parallelize modules without asking.

## Commit discipline

- After any prompt that results in a completed, verified, self-contained unit of work (a sub-chunk, a chunk, a bug fix, a migration) — Claude Code does not run `git commit` itself. Instead, stage the changes (`git add`) and give the exact commit message it would have used. The user reviews the diff and runs `git commit` themselves.
- One commit per logical unit of work. Don't bundle multiple unrelated sub-chunks/fixes into a single commit, and don't split one coherent change across several commits either.
- Commit message format: a short imperative summary line (e.g. "Module 4: add duplicate-prevention constraint + create_lead_from_match()"), optionally followed by a couple of bullet points if the change has distinct parts worth calling out.
- Only stage and propose a message for work that's actually been verified per this project's standing bar (real invocation, not just tsc/build passing) — an unverified or partially-working change should stay unstaged and be flagged as such, not proposed with a caveat buried in the message.
- Never push to any remote (origin/GitHub) without separate, explicit permission each time — local commits are cheap and reversible, pushing is a different, separate decision.
- If a task naturally produces several distinct commits (e.g. "fix bug" then "add test coverage for it"), that's fine — prefer more small, clear commits over one large vague one.

## When something in the code and something in `/docs` disagree

Flag it and ask — don't silently pick one. The docs represent decisions made with the team; the code should catch up to them, not the other way around.
