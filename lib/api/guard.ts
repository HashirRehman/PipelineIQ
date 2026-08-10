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
//
// The strict Origin-vs-Host compare is what breaks on some deployments:
// behind a proxy/CDN the `host` header can be rewritten to the origin
// server while the browser's Origin keeps the public domain, so a genuine
// same-site POST gets rejected (works locally, fails when deployed). The
// forwarded host (Vercel sends it identical to `host`) and the app's
// configured canonical origin (NEXT_PUBLIC_SITE_URL) are accepted as
// equivalents. This stays safe because the session cookie is SameSite=Lax —
// cross-site POSTs never carry it and fail auth with 401 anyway; an attacker
// can't forge the Origin header, so they can't spoof a match.
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client (mobile, curl)

  const originHost = hostOf(origin);
  if (!originHost) return false;

  const host = request.headers.get("host");
  if (host === originHost) return true;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost === originHost) return true;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && hostOf(siteUrl) === originHost) return true;

  return false;
}
