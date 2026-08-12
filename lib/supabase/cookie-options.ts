/**
 * Shared session cookie options for the server-side Supabase clients.
 *
 * Supabase's @supabase/ssr default is `{ path: "/", sameSite: "lax",
 * httpOnly: false, maxAge: 400*24*60*60 }` — JavaScript-readable and a
 * ~400-day lifetime. That makes any XSS a full, persistent session theft
 * and is unnecessary: nothing in this app needs to read the session cookie
 * from the browser anymore (all session establishment and refresh happens
 * server-side), so the cookie is hardened here:
 *
 * - `httpOnly: true` — the access/refresh tokens are never exposed to
 *   `document.cookie`; no script on the page can read them.
 * - `sameSite: "lax"` — stops cross-site POSTs from carrying the cookie
 *   (defense-in-depth under the explicit Origin-vs-Host CSRF check).
 * - `secure: true` in production (HTTPS on Vercel). Gated on NODE_ENV so
 *   local HTTP dev keeps working; `SESSION_COOKIE_SECURE` overrides it in
 *   either direction for deployments that need the opposite.
 * - `maxAge: 30 days` — bounded, vs. the 400-day default.
 */
const secureOverride = process.env.SESSION_COOKIE_SECURE;

export const supabaseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: secureOverride !== undefined
    ? secureOverride === "true"
    : process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
