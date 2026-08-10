// CSRF defense for this app's API routes.
//
// Server Actions get Next's built-in Origin-vs-Host CSRF check; Route
// Handlers don't, so state-changing POST routes opt into one explicitly.
// The session cookie is SameSite=Lax, which already stops cross-site POSTs
// from carrying it (auth would fail with 401) — this check is
// defense-in-depth on top of that.
//
// It only rejects when an Origin header IS present and mismatches Host.
// Browsers always send Origin on cross-site POSTs, and same-origin POSTs
// match Host — so the web app is unaffected. Non-browser clients (the
// future mobile app's Bearer-token calls, curl, cron) send no Origin header
// and are allowed through.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client (mobile, curl)

  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
