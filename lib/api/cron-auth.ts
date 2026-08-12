import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time authorization check for cron routes.
 *
 * The Vercel cron system authenticates with `Authorization: Bearer
 * <CRON_SECRET>`. Comparing with a plain `!==` leaks timing information
 * about the secret's prefix — cryptographically negligible, but trivially
 * avoidable, and security-hardening best practice is to compare secrets
 * with a constant-time function.
 *
 * Fails closed: an unset CRON_SECRET (e.g. local dev) always returns false,
 * so an unprotected cron endpoint can never run by accident.
 */
export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expectedHeader, "utf8");

  // timingSafeEqual throws on length mismatch — compare lengths first.
  // The lengths differ only when the secret (or header format) is wrong,
  // so this reveals no usable information about the secret itself.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
