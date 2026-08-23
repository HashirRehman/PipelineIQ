# CLAUDE.md

Persistent project context for Claude Code. Read this at the start of every session — it captures decisions that live in our planning docs, not in the code itself, so don't rediscover or second-guess them from scratch.

## What this project is

An internal platform (single-tenant, built for one company's own BD team — never multi-tenant) that centralizes candidate profiles, uses AI to discover matching jobs, and tracks every application from first contact to close. Schema reference: `supabase/database-schema.md`.

## Stack

- **Frontend + backend**: Next.js (App Router), API-first — all mutations go through Route Handlers (`app/api/*`) driven by `lib/api/*` client helpers; no Server Actions, no separate backend service.
- **Database + Auth + Storage**: Supabase (Postgres, built-in Auth, Storage). Row Level Security is disabled on every public-schema table — see the RLS rule below.
- **Scheduled jobs**: nightly cron (Vercel Cron or pg_cron + Edge Function) — must be idempotent.
- **Job source**: recommended MVP source is JSearch (free tier, explicit remote-job filter). Confirm before building if this hasn't been finalized yet.
- **LLM provider**: TBD — wrapped behind a single internal `AiClient` interface. Never call a provider SDK directly from feature code.

## Current build scope — read this before touching anything

**Current scope**: Authentication & User Management, Profiles (candidate roster), AI-Powered Job Discovery, and Leads — all on the fresh 13-table schema. The Profiles (candidate roster) module is ported from the old `engineers` code onto `profiles`/`profile_cvs` via API routes (`app/api/profiles/*`) backed by `lib/services/profiles.ts`; Leads is still the static `LeadsTab` until real data lands. Don't build screens, Server Actions, or UI for anything outside that scope unless explicitly asked — stop and ask rather than assuming.

## Rules that must not be silently reinterpreted

- **One role per user, on `users.role_id`.** Roles are tables (`roles`), not an enum — but there is **no `user_roles` join table**; a user's single role is a `users.role_id` FK. Don't reintroduce a join table or a `role` enum.
- **RLS is disabled everywhere; the backend is the access-control boundary.** (Decision made 2026-08-23, reversing the earlier RLS-first model — see git history of `supabase/migrations/` before this date if that lineage is ever needed.) No public-schema table has Row Level Security enabled, and no `is_admin()`/`is_bd_manager()`/`current_org_id()`-style SECURITY DEFINER helper exists — those were removed because they existed only to back RLS policies. Every Route Handler / `lib/services/*` function MUST check org membership, role, and row ownership in code before it queries or mutates — the same checks RLS used to make, just moved into TypeScript (see `lib/services/profiles.ts`'s `requireProfileManagerUser()` + explicit `.eq("organization_id", ...)` filters for the pattern to follow). Never add a query that assumes a table's GRANTs alone scope visibility — a GRANT now only says which verbs the backend may issue, not which rows a given caller may see. The `profile-cvs` Storage bucket follows the same model one level further: `storage.objects` has no client-facing policies at all (Supabase forces its RLS on and this project can't disable it), so `authenticated`/`anon` have zero bucket access and only the service-role client (`lib/supabase/admin.ts`) can read/write/delete objects — clients get files via signed URLs minted by the backend after it authorizes the request, never direct bucket access.
- **Duplicate-lead prevention**: at most one live lead per (job, profile) pair. Leads are created from the Pipeline page via POST `/api/leads`, which enforces the rule (idempotent — returns the existing live lead). Don't add a second creation path that bypasses it.
- **Applier's Notes**: a lead's `notes` are writable only by the user whose assigned profile was used to apply (the permanent `leads.user_id` snapshot) — enforced in the PATCH route and gated in the UI. Don't let status/stage updates or other roles edit notes.
- **Lead ownership is a permanent snapshot.** `leads.user_id` never changes when a profile is reassigned to a different user. Don't "fix" this by deriving ownership from current assignment.
- **Comments are a flat, open org-wide thread on jobs** (`job_comments` — migration 10, additive via `npm run migrate:up`). Any org member can read and comment; edits are author-only; deletes are author-or-admin. No replies / no `parent_id`. The drawer loads the same thread for a job everywhere (Discovery, Pipeline, and Leads via `commentsJobId`). Don't make comments owner-scoped like notes, and don't add replies or pagination without asking.
- **Job source access goes through `JobSourceAdapter`.** Never call JSearch/Adzuna/Apify APIs directly from a Server Action — write or extend an adapter, and route everything through `lib/job-sources/registry.ts` (which maps adapters to `scrapers` rows by name).
- **AI calls go through the `AiClient` interface** in `lib/ai/client.ts`. Same reasoning — provider swaps should never touch feature code.
- **Remote-region eligibility (`jobs.remote_allowed_region`) is free text, not a lookup table.** Don't normalize it into a `regions` table unless explicitly asked — the data isn't clean enough yet.
- **Account creation is Admin-only**, via Supabase's invite-by-email flow. Never build a self-signup path. Nobody, including Admin, ever sets another user's password directly.

## Working conventions

- UUID primary keys, `timestamptz` for all timestamps, `created_at`/`updated_at` only where a row is actually ever updated.
- Use Plan Mode (`Shift+Tab`) before any multi-file change — lay out the approach, wait for approval, then execute.
- Migrations before features: when starting a new module, write/verify the relevant SQL migration first, get it reviewed, then build the API routes and UI on top.
- Build in this order: Module 1 → 2 → 3 → 4. Don't jump ahead or parallelize modules without asking.
- **File names are always kebab-case**, no exceptions — components, hooks, types, everything (`stat-card.tsx`, `use-lead-filters.ts`, `job-comments.tsx`). Never PascalCase a file just because the component it exports is PascalCase; the export name and the file name are independent.

### Chart pattern (ECharts)

Charts render through **Apache ECharts** (`echarts` + `echarts-for-react`), not any other chart library — see `components/charts/`.

- Use `echarts-for-react`'s `ReactEChartsCore` component (imported from `echarts-for-react/lib/core`), not a hand-rolled `echarts.init`/`dispose` lifecycle hook. The library already solves React-integration lifecycle edge cases (StrictMode double-invoke, resize, teardown) — reinventing that lifecycle is the wrong layer to spend effort on.
- Register only the chart types/components actually used, via `echarts/core` + tree-shaken imports (`components/charts/echarts-setup.ts`) — not the full `echarts` bundle.
- Memoize every chart's `option` object (`useMemo`, keyed on real inputs). If a caller rebuilds an array/object prop fresh every render (common with derived chart data), key the memo on a content fingerprint (`JSON.stringify(...)`) instead of relying on reference equality — an unmemoized or falsely-changing `option` forces ECharts to rebuild on every render, which shows up as tooltip flicker on hover, not just wasted work.
- **Any color handed to an ECharts `option` must be a resolved concrete value, never a raw `var(--token)` or `color-mix(...)` string.** The rest of the app hands CSS custom properties straight to `style`/className, which works because DOM/CSS resolves them — but ECharts draws to `<canvas>`, which has no concept of CSS custom properties and silently renders unresolved color functions as black. Use `resolveColor()` from `components/charts/chart-theme.ts` on any color sourced from `lib/constants.ts` (`BRAND.*`, `STATUS.*`, `SERIES_PALETTE`, `stageColor()`) before it reaches a series/itemStyle.
- Prefer ECharts' own tooltip/axis/label rendering over hand-built HTML formatters — reach for a custom `formatter` only when the built-in template genuinely can't express the content (e.g. a multi-row per-series breakdown), and even then keep it minimal. Extra styling stacked on top of ECharts' own tooltip box (`backgroundColor: "transparent"`, zero padding, custom CSS text) fights the library's own positioning/rendering rather than working with it.
- Not every chart-shaped thing needs to be a canvas chart. `FunnelChart` is deliberately plain HTML/CSS (flex rows + width percentages) because its row count is dynamic and it needs to sit in a scrollable, height-capped container — a genuinely simpler and more flexible solution than forcing ECharts to do it.

## Commit discipline

- After any prompt that results in a completed, verified, self-contained unit of work (a sub-chunk, a chunk, a bug fix, a migration) — Claude Code does not run `git commit` itself. Instead, stage the changes (`git add`) and give the exact commit message it would have used. The user reviews the diff and runs `git commit` themselves.
- One commit per logical unit of work. Don't bundle multiple unrelated sub-chunks/fixes into a single commit, and don't split one coherent change across several commits either.
- Commit message format: a short imperative summary line (e.g. "Discovery: exclude applied/dismissed pairs from the feed"), optionally followed by a couple of bullet points if the change has distinct parts worth calling out.
- Only stage and propose a message for work that's actually been verified per this project's standing bar (real invocation, not just tsc/build passing) — an unverified or partially-working change should stay unstaged and be flagged as such, not proposed with a caveat buried in the message.
- Never push to any remote (origin/GitHub) without separate, explicit permission each time — local commits are cheap and reversible, pushing is a different, separate decision.
- If a task naturally produces several distinct commits (e.g. "fix bug" then "add test coverage for it"), that's fine — prefer more small, clear commits over one large vague one.

## Known residual risks

- **Prompt truncation, unverified beyond one data point.** Head+tail truncation (1000+500 chars) was added to `scoreRelevance` and `extractRemoteRegion` in `lib/ai/groq-client.ts` to reduce Groq token cost. It was verified clean on exactly ONE real job (Discovery Education: score 60, unchanged pre/post truncation). The full intended verification — the 6-job scoring battery (Nurse, Marketing, .NET, Holepunch, Dragos) and the Turing/Fed95 eligibility recheck — was never completed, blocked repeatedly by Groq's daily token quota across multiple sessions.
- **Decision made 2026-07-28**: proceed to deployment without completing this verification. Accepted risk: truncation could theoretically be cutting off signal that affects scoring accuracy or eligibility detection on some postings, unverified beyond the one clean data point and the deliberate head+tail design reasoning.
- If a scoring or eligibility result looks wrong in real production usage, this truncation work is the first place to check — re-run the originally-planned battery test (fixtures preserved in `.tmp-verify/`, gitignored) before assuming the bug is elsewhere.
- This is a decision record, not an open bug — don't silently re-run the battery and close this out on your own; if it ever gets completed, surface the result back to the user first.

## When something in the code and something in `/docs` disagree

Flag it and ask — don't silently pick one. The docs represent decisions made with the team; the code should catch up to them, not the other way around.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
