import { NextResponse } from "next/server";
import { logAudit } from "@/lib/api/audit";
import { isSameOrigin } from "@/lib/api/guard";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  createClient,
  getCachedOrganizationId,
  getCachedUser,
} from "@/lib/supabase/server";
import { setPasswordSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Your invite link has expired. Request a new one." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  // Burst cap per IP plus a tighter per-user cap — a stolen/leaked session
  // can't be used to grind through password guesses, and a misbehaving
  // client can't hammer updateUser (defense-in-depth, see lib/api/rate-limit.ts).
  const ipLimit = checkRateLimit(`set-password:ip:${clientIp(request)}`, 15, 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterMs);

  const userLimit = checkRateLimit(`set-password:user:${user.id}`, 5, 60_000);
  if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfterMs);

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("api/auth/set-password: updateUser failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  // Revoke every OTHER session for this user (password-change session
  // revocation — the Supabase equivalent of Better Auth's
  // revokeSessionsOnPasswordReset). A password change should invalidate
  // sessions on devices the user isn't on right now: anyone holding an
  // old refresh token must re-authenticate with the new password.
  //
  // scope: 'others' deliberately keeps THIS session — it was established by
  // confirming the invite link (or belongs to the signed-in user), so the
  // user lands straight on the dashboard with the password they just chose,
  // no redundant re-login.
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "others",
  });
  if (signOutError) {
    // The password change succeeded; a failed revocation means older
    // sessions linger until they expire. Log loudly rather than fail the
    // request — the user has already set their password.
    console.error(
      "api/auth/set-password: could not revoke other sessions",
      signOutError,
    );
  }

  // Audit: password set / changed (best-effort; skips only if the org
  // couldn't be resolved).
  const organizationId = await getCachedOrganizationId();
  if (organizationId) {
    await logAudit({
      supabase,
      organizationId,
      actorUserId: user.id,
      action: "password_set",
      targetEmail: user.email ?? undefined,
      request,
    });
  }

  return NextResponse.json({ success: true });
}
