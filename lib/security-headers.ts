import { randomUUID } from "node:crypto";

/**
 * Per-request Content-Security-Policy + static security headers.
 *
 * The CSP uses a fresh nonce per request (see proxy.ts). The nonce is
 * embedded in the response header the browser enforces, and also forwarded
 * on the request so that:
 *   - Next's renderer parses the first `'nonce-…'` out of script-src and
 *     applies it to every script it emits (bundles + inline flight data),
 *   - the root layout reads `x-csp-nonce` to nonce the two intentional
 *     inline scripts (the theme bootstrap and next-themes).
 *
 * With that in place, `script-src` needs no `'unsafe-inline'`: `'strict-dynamic'`
 * lets scripts the nonced bundle creates (e.g. Vercel Analytics injecting its
 * loader via document.createElement) load, while blocking any attacker-
 * injected inline script. `style-src 'unsafe-inline'` remains because React
 * renders inline style attributes and the theme system injects <style> blocks
 * at runtime — those are data, not code.
 */
export function generateCspNonce(): string {
  return Buffer.from(randomUUID()).toString("base64url");
}

export function buildCsp(nonce: string): string {
  let supabaseHost = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    supabaseHost = url ? new URL(url).host : "";
  } catch {
    // Misconfigured env — omit; the CSP still applies for everything else.
  }

  const connectSrc = [
    "'self'",
    "https://va.vercel-scripts.com", // Vercel Analytics beacon
    ...(supabaseHost
      ? [`https://${supabaseHost}`, `wss://${supabaseHost}`]
      : []),
  ];

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Static security headers applied to every response the proxy produces.
 * `frame-ancestors 'none'` (in the CSP) + `X-Frame-Options: DENY` cover
 * clickjacking for browsers old and new; `nosniff` stops MIME sniffing;
 * `Referrer-Policy` keeps the org's internal URLs out of external
 * Referer headers (e.g. the apply links); `Permissions-Policy` disables
 * camera/mic/geolocation this app never uses.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
