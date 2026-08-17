# Security Best Practices Report — PipelineIQ

**Scope:** Full-stack (frontend + backend) audit of the `saqib/forgot-password-page` branch (HEAD `89f67d6`), reviewed against the `security-best-practices` skill references: `javascript-typescript-nextjs-web-server-security.md` (Next.js 16 backend / Route Handlers / Proxy), `javascript-typescript-react-web-frontend-security.md` (React 19 frontend), `javascript-general-web-frontend-security.md`.
**Date:** 2026-08-17
**Stack identified:** Next.js 16.3.0 (App Router, Route Handlers, Proxy), React 19.2.4, TypeScript, Zod 4, Supabase (Auth + Postgres via `@supabase/ssr`), Vercel (deploy + cron), Cloudinary (CV storage), JSearch/Groq (external APIs).
**Branch delta reviewed:** forgot-password flow (page, form, route), recovery-aware set-password + confirm page, login "Forgot password?" link, `forgotPasswordSchema`. The branch also carries all prior hardening (cookies, CSP, rate limiting, RLS, audit).

---

## Executive Summary

This branch is in strong security shape. Every API route enforces authentication; every state-changing route runs an Origin-vs-Host CSRF check; all request bodies are schema-validated with Zod 4; sessions are HttpOnly/SameSite=Lax/Secure-in-prod with a 30-day lifetime; a strict nonce-based CSP plus static security headers are applied at the proxy; there is no `eval`/`child_process`/raw SQL/`innerHTML`/`dangerouslySetInnerHTML`-with-untrusted-content; no secrets are committed or bundled client-side; uploads are size/MIME-limited and stored in Cloudinary outside the webroot; cron endpoints use a constant-time secret check; and RLS is org-scoped on all tenant tables with anon grants closed.

**No Critical or High severity vulnerabilities were found in this review.** The prior audit's three HIGH findings (outdated Next.js, JS-readable cookies, no rate limiting/CSP) are all resolved on this branch.

One finding is reported as **MEDIUM — needs verification** (host-header-derived `redirectTo` fallback, exploitability depends on deployment host control). Everything else is LOW/defense-in-depth hardening notes or "verify at runtime" items.

---

## Status of previously-reported findings (from the 2026-08-12 audit)

| ID | Finding (was) | Status on this branch | Evidence |
|---|---|---|---|
| BP-001 | Next.js 16.2.10 behind 9 HIGH advisories | ✅ **Resolved** | `package.json`: `"next": "^16.3.0"` (patched line; above all react2shell-affected versions, which are < 16.0.7) |
| BP-002 | Session cookies JS-readable (`httpOnly: false` default) | ✅ **Resolved** | `lib/supabase/cookie-options.ts`: `httpOnly: true`, `sameSite: "lax"`, `secure` gated on `NODE_ENV`/`SESSION_COOKIE_SECURE`, `maxAge: 30 days`. Browser client `lib/supabase/client.ts` deleted; all session establishment server-side (`app/api/auth/confirm/route.ts`) |
| BP-003 | No rate limiting on auth endpoints | ✅ **Resolved** | `lib/api/rate-limit.ts` — per-IP burst cap + per-account lockout with exponential backoff; wired into `app/api/auth/login/route.ts` and `app/api/auth/set-password/route.ts` |
| BP-004 | No CSP / security headers | ✅ **Resolved** | `proxy.ts` + `lib/security-headers.ts` — per-request nonce CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`) + `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| BP-005 | `xlsx` advisories (no upstream fix) | ⏸ Deferred (documented; client-side-only import, review date set) | Previous report |
| BP-006 | Non-constant-time cron secret check | ✅ **Resolved** | `lib/api/cron-auth.ts` — `timingSafeEqual`, fails closed on unset `CRON_SECRET` |
| — | Confirm page double-`decodeURIComponent` 500 | ✅ **Resolved** | `app/(auth)/login/page.tsx` renders searchParams once (React-escaped), comment documents the fix |

---

## Findings (this branch)

### MEDIUM — needs verification

#### [FP-01] `redirectTo` fallback derives a security-sensitive URL from the request Host header
- **Rule:** NEXT-HOST-001 (host/origin-derived URL construction must be allowlisted)
- **Location:** `app/api/auth/forgot-password/route.ts:65-66` and `app/api/users/route.ts:187-188`
- **Evidence:**
  ```ts
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    new URL(request.url).origin;
  ```
- **Impact:** If an attacker can reach the origin directly with a forged `Host` header **and** `NEXT_PUBLIC_SITE_URL` is unset, the password-reset / invite email would link to an attacker-controlled origin (password-reset poisoning): the victim's reset token lands on the attacker's page. On Vercel, `Host` is validated by the platform, so this is likely not exploitable in production — **verify host validation at the deployment edge.**
- **Fix (defense-in-depth):** fail closed — use only `NEXT_PUBLIC_SITE_URL` in production, or validate the fallback origin's host against an allowlist of known app origins before using it. A local-dev-only fallback is fine behind `NODE_ENV !== "production"`.
- **False-positive note:** if `NEXT_PUBLIC_SITE_URL` is always set in production and the platform controls `Host`, this is not exploitable.

### LOW — hardening notes (not reported as findings)

- **[FP-02] No app-level rate limit on `/api/auth/forgot-password`.** The route relies on Supabase's platform email rate limit and surfaces its 429 (`app/api/auth/forgot-password/route.ts`, `error.status === 429` handling). This is acceptable (the reset email is the expensive resource and Supabase bounds it), but an app-level per-IP cap matching the login limiter would add defense-in-depth. NEXT-DOS-001.
- **[FP-03] `/api/discovery/run` (POST) has no rate limit.** Any role with `canAccessJobs` can trigger a platform-wide discovery run that consumes paid JSearch/Groq quota. Frequency is bounded by the cooldown lock (`acquireDiscoveryLock`), which materially reduces the risk; a per-user/IP cap would harden it further. NEXT-DOS-001.
- **[FP-04] In-memory rate limiter is per-instance on Vercel serverless.** Already honestly documented in `lib/api/rate-limit.ts` ("bounds attempts per instance, not globally"). Fine for defense-in-depth; a DB/edge-backed limiter would be needed for a hard boundary.
- **[FP-05] `app/api/auth/confirm/route.ts:88` falls back to `"invite"` when `type` is absent on a token-hash link.** The app's own recovery flow uses the implicit flow (fragment tokens → `setSession`), so the recovery token-hash path isn't exercised; Supabase includes `type` on OTP links. No exploit identified.

### INFO — verified safe by construction

- **Middleware decodes the access-token JWT without verifying its signature** (`lib/supabase/middleware.ts`, `userIdFromAccessToken`). Safe: the decoded `sub` only drives the *extra* deactivation check, which is skipped unless `getUser()` (cryptographically verified) already returned a user; a forged token yields `user = null` and never reaches the deactivation branch.
- **`dangerouslySetInnerHTML` in `components/theme/theme-bootstrap-script.tsx`** injects a build-time constant `SCRIPT` (static CSS maps + storage keys), nonce'd by the CSP. `localStorage` values are looked up against constant-key maps and dropped when unknown. No user input reaches the sink.
- **`lib/cv-parsing/parse-cv.ts` fetches `profile_cvs.storage_path`** (SSRF surface), but writes are pinned to `https://res.cloudinary.com` at upload time (`lib/services/profiles.ts:433`), and the function rejects anything not `https://`. No attacker-controlled host.
- **`isSameOrigin`** (Origin-vs-Host, `lib/api/guard.ts`) is applied to every state-changing route; combined with `SameSite=Lax` this satisfies NEXT-CSRF-001's "strict Origin/Referer + SameSite" option for cookie-authenticated JSON APIs. No `allowedOrigins` wildcards; no Server Actions in use.

---

## Verified-strong inventory (this branch)

| Area | Status | Evidence |
|---|---|---|
| **Authn on every protected route** | ✅ All 18 business API routes enforce `getUser`/`getCachedUser` + role gate + org verification (`verifyOrganizationAccess`) | `app/api/**/route.ts`; `lib/api/organization.ts`; scan found no route missing a 401 except the intentionally-public `forgot-password` |
| **Org scoping** | ✅ Every query/mutation filtered by the caller's verified `organization_id`; client-supplied org id re-verified server-side | `lib/api/organization.ts` (header `x-organization-id` / `?organizationId=`, mismatch → 403) |
| **RLS** | ✅ Multi-tenant scoping applied (migration `20260812100000`) — org-scoped policies on all tenant tables; user management admin-only; catalog tables trimmed to `grant select`; blanket authenticated grant revoked; anon grants closed (`20260812120000`) | `supabase/migrations/` |
| **CSRF** | ✅ Origin-vs-Host check on all state-changing POST/PATCH/DELETE | `lib/api/guard.ts` |
| **Cookies** | ✅ HttpOnly + SameSite=Lax + Secure-in-prod + 30-day maxAge | `lib/supabase/cookie-options.ts` |
| **XSS** | ✅ No untrusted `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write`; React default escaping; login URL params React-escaped | grep scan; `app/(auth)/login/page.tsx` |
| **CSP + headers** | ✅ Per-request nonce CSP (`strict-dynamic`, no `unsafe-inline` for scripts) + nosniff/XFO/Referrer-Policy/Permissions-Policy | `proxy.ts`; `lib/security-headers.ts` |
| **Input validation** | ✅ Zod 4 schemas on every route (UUIDs, emails, lengths, real-calendar-date check); `setPasswordSchema` caps at 8–256 chars **and 72 bytes** (bcrypt truncation) | `lib/validation/schemas.ts` |
| **Injection** | ✅ No raw SQL / string-built queries — Supabase query builder only (parameterized); no `child_process` | grep scan |
| **Secrets** | ✅ `.env` untracked (only `.env.example` with placeholders); no secrets in `NEXT_PUBLIC_*`; no `process.env`/`NEXT_PUBLIC_*` in `"use client"` files | `git ls-files`; grep scan |
| **Auth flow (new)** | ✅ Forgot-password: generic success (anti-enumeration), 429 surfaced, implicit-flow reset mail (device-agnostic), `flow=recovery` marker, confirm → server-side exchange → `/set-password?flow=recovery`; set-password keeps the session (`signOut({ scope: "others" })`) and lands on the dashboard | `app/api/auth/forgot-password/route.ts`, `app/api/auth/confirm/route.ts`, `app/auth/confirm/page.tsx`, `app/(auth)/set-password/*` |
| **Rate limiting** | ✅ Login (IP burst 20/min + per-account lockout 5 fails → 60s, exponential to 15min), set-password (IP 15/min + per-user 5/min) | `lib/api/rate-limit.ts` |
| **Cron** | ✅ Constant-time `Bearer` secret check, fails closed; discovery lock with cooldown | `lib/api/cron-auth.ts`, `app/api/cron/*` |
| **Uploads** | ✅ 10 MB cap, MIME allowlist (PDF/DOC/DOCX), stored in Cloudinary (outside webroot), org-verified profile, orphan cleanup on failed insert | `lib/services/profiles.ts` |
| **Audit** | ✅ Append-only `audit_logs` (admin-select only, no update/delete), org-bound, 5 wired actions; `user_deleted` FK ordering fixed (identity via `target_email` + metadata) | `lib/api/audit.ts`, `app/api/users/route.ts` |
| **Deactivation** | ✅ Login gate + middleware enforcement on live sessions; last-admin DB guard trigger (incl. org-move) | `app/api/auth/login/route.ts`, `lib/supabase/middleware.ts`, migration `20260812000000` |
| **Caching/static** | ✅ All data routes `force-dynamic`; no `use cache`/`force-static` on user data | route files |

---

## What to verify at runtime (outside app code)

1. **Vercel edge / platform:** `Host` validation (FP-01), and that `NEXT_PUBLIC_SITE_URL` is set in production.
2. **Supabase project settings:** the `/auth/confirm` path (with `?flow=recovery` for resets) is in the **redirect allow list**, or reset links silently fall back to `site_url` and land on `/login`; email template link shapes; invite/OTP expiry.
3. **`npm audit`:** only the unfixable `xlsx` advisory should remain (client-side, deferred with review date).
4. **`npm run migrate:up`** has been run (all migrations applied — verified via `migration list` in prior testing; `audit_logs` is natively typed, the type shim was removed).

---

## Recommended next steps (in order)

1. **FP-01:** make the `redirectTo` fallback fail closed (allowlist the fallback host or require `NEXT_PUBLIC_SITE_URL` in production). Small, low-risk change.
2. **FP-02 / FP-03:** add per-IP caps to forgot-password and discovery/run using the existing `checkRateLimit` helper.
3. Optionally: `2FA/TOTP`, Google SSO, or magic links via Supabase's native add-ons when the product needs them.
