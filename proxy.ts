import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Sections that live inside the authenticated dashboard shell. */
const DASHBOARD_PATHS = [
  "/profiles",
  "/discovery",
  "/leads",
  "/users",
  "/statistics",
];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  const isDashboard =
    pathname === "/" ||
    DASHBOARD_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );

  if (isDashboard && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
