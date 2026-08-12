import { NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Returns the signed-in user's id. Client components that used to call
 * supabase.auth.getUser() in the browser (reading the session cookie via
 * document.cookie) can call this instead — the cookie stays HttpOnly.
 */
export async function GET() {
  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ userId: user.id });
}
