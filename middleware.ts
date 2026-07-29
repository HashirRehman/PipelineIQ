import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Reads is_admin from the JWT's claims (custom_access_token_hook
    // migration) rather than a live supabase.rpc("is_admin") round trip —
    // ES256-signed JWTs verify locally via getClaims() (cached JWKS), no
    // per-request network call. App-layer routing convenience only; RLS
    // policies still call is_admin() live at query time regardless.
    const { data: claimsData } = await supabase.auth.getClaims();
    const isAdmin = claimsData?.claims?.is_admin === true;
    if (!isAdmin) {
      const url = new URL("/engineers", request.url);
      url.searchParams.set("error", "not_authorized");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Excludes static assets and Module 3's future cron route, which has
    // no browser session and would otherwise get redirected to /login.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
