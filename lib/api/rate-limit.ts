import { NextResponse } from "next/server";

/**
 * Lightweight rate limiting for auth endpoints (login, set-password).
 *
 * Honest scope note: on Vercel's serverless runtime each function instance
 * has its own memory, so an in-memory limiter bounds attempts per instance,
 * not globally across every warm instance. It is defense-in-depth on top of
 * Supabase Auth's own platform throttling of signInWithPassword — not a hard
 * boundary — and it fully protects a self-hosted / long-running Node deploy.
 * A DB- or edge-backed limiter would be the next step if this ever needs to
 * be a hard boundary.
 *
 * Two complementary controls:
 * - `checkRateLimit` — sliding-window burst cap per key (IP).
 * - `recordLoginFailure` / `isLoginLocked` — per-account exponential
 *   backoff after repeated failed passwords, so a single account can't be
 *   hammered even from rotating IPs. Keys are the lowercase email, and
 *   success clears the counter.
 */

/** An entry is expired once `now` passes its `resetAt`. */
interface TimedEntry {
  count: number
  resetAt: number
}

const windows = new Map<string, TimedEntry>()
const failures = new Map<string, Failure>()

// Bound memory: once a map grows past this, sweep expired entries on the
// next call. Prevents a flood of distinct IPs from growing the map forever.
const MAX_ENTRIES = 10_000

function pruneExpired(now: number, ...maps: Map<string, TimedEntry>[]) {
  if (maps.every((m) => m.size < MAX_ENTRIES)) return
  for (const map of maps) {
    for (const [key, entry] of map) {
      if (now >= entry.resetAt) map.delete(key)
    }
  }
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  pruneExpired(now, windows)

  const w = windows.get(key)
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (w.count >= max) {
    return { allowed: false, retryAfterMs: w.resetAt - now }
  }
  w.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

/* ── Per-account failure lockout ─────────────────────────────────────── */

const LOCKOUT_THRESHOLD = 5 // consecutive failures before lockout
const LOCKOUT_BASE_MS = 60_000 // 1 minute
const LOCKOUT_CAP_MS = 15 * 60_000 // 15 minutes
// The failure counter resets if the account goes this long without a new
// failed attempt (i.e. 4 failures spread over an hour do NOT lock the user).
const LOCKOUT_RESET_MS = 15 * 60_000

interface Failure extends TimedEntry {
  /** Set (= resetAt) only while the account is actually locked out. */
  lockedUntil: number
}

/**
 * Register a failed login. The count accumulates within the window; once it
 * crosses the threshold the account locks with an exponentially doubling
 * backoff (capped), doubling per excess failure.
 */
export function recordLoginFailure(
  key: string,
): { locked: boolean; retryAfterMs: number } {
  const now = Date.now()
  pruneExpired(now, failures)

  const prior = failures.get(key)
  const count = (prior && now < prior.resetAt ? prior.count : 0) + 1

  let locked = false
  let resetAt = now + LOCKOUT_RESET_MS
  if (count >= LOCKOUT_THRESHOLD) {
    locked = true
    const backoff = Math.min(
      LOCKOUT_BASE_MS * 2 ** (count - LOCKOUT_THRESHOLD),
      LOCKOUT_CAP_MS,
    )
    resetAt = now + backoff
  }
  failures.set(key, { count, resetAt, lockedUntil: locked ? resetAt : 0 })
  return locked ? { locked, retryAfterMs: resetAt - now } : { locked, retryAfterMs: 0 }
}

/**
 * True while the account key is locked out. Expired entries (locked or not)
 * are dropped so a stale counter can never resurrect an old lock.
 */
export function isLoginLocked(key: string): { locked: boolean; retryAfterMs: number } {
  const f = failures.get(key)
  if (!f) return { locked: false, retryAfterMs: 0 }
  const now = Date.now()
  if (now >= f.resetAt) {
    failures.delete(key)
    return { locked: false, retryAfterMs: 0 }
  }
  if (f.lockedUntil > now) {
    return { locked: true, retryAfterMs: f.lockedUntil - now }
  }
  return { locked: false, retryAfterMs: 0 }
}

/** Successful login clears the account's failure counter. */
export function clearLoginFailures(key: string) {
  failures.delete(key)
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

/** The shared 429 response for rate-limit rejections, with Retry-After. */
export function rateLimitResponse(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Too many attempts. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
    },
  );
}
