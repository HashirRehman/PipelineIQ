/**
 * The canonical app origin used to build auth email links (invites, password
 * resets).
 *
 * NEXT_PUBLIC_SITE_URL is the source of truth in every environment. Outside
 * production, the request's own origin is an acceptable local-dev fallback
 * (localhost has no canonical origin). In production the fallback is refused:
 * a security-sensitive email link must never be derived from an unvalidated
 * Host header — an attacker who can control Host could poison the reset/invite
 * link to point at their own origin (password-reset poisoning). Callers get
 * null and should refuse to send the email rather than mail a poisoned link.
 */
export function resolveSiteUrl(request: Request): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") return null;

  return new URL(request.url).origin;
}
