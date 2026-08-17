import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  buildCsp,
  generateCspNonce,
  SECURITY_HEADERS,
} from "@/lib/security-headers";

/** Sections that live inside the authenticated dashboard shell. */
const DASHBOARD_PATHS = [
  "/profiles",
  "/discovery",
  "/applied-jobs",
  "/leads",
  "/users",
  "/statistics",
];

function applySecurityHeaders(
  response: NextResponse,
  csp: string | null,
) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (csp) response.headers.set("content-security-policy", csp);
}

export async function proxy(request: NextRequest) {
  // Security headers — see lib/security-headers.ts. The CSP carries a fresh
  // per-request nonce so the intentional inline scripts (theme bootstrap +
  // next-themes) can be trusted without script 'unsafe-inline'. The nonce
  // and CSP are forwarded on the request: Next's renderer parses the first
  // 'nonce-…' out of the CSP header and applies it to every script it
  // emits, and the root layout reads x-csp-nonce to nonce its own inline
  // scripts. The response header is what the browser enforces.
  //
  // No CSP is sent in dev (Next's HMR needs inline/eval'd scripts), but the
  // nonce header and static headers are harmless there.
  const nonce = generateCspNonce();
  const csp = buildCsp(nonce);
  const isProd = process.env.NODE_ENV === "production";

  request.headers.set("x-csp-nonce", nonce);
  if (isProd) request.headers.set("content-security-policy", csp);

  const { response, user } = await updateSession(request);

  applySecurityHeaders(response, isProd ? csp : null);

  const { pathname } = request.nextUrl;

  const isDashboard =
    pathname === "/" ||
    DASHBOARD_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );

  if (isDashboard && !user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    applySecurityHeaders(redirect, isProd ? csp : null);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
