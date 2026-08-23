import { NextResponse, after } from "next/server";
import { logAudit } from "@/lib/api/audit";
import { isSameOrigin } from "@/lib/api/guard";
import {
  checkRateLimit,
  clientIp,
  clearLoginFailures,
  isLoginLocked,
  rateLimitResponse,
  recordLoginFailure,
} from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  // Rate limiting (defense-in-depth on top of Supabase's own throttling —
  // see lib/api/rate-limit.ts): a per-IP burst cap, then a per-account
  // lockout with exponential backoff after repeated failures. The account
  // key is the normalized email so a single account can't be hammered even
  // from rotating IPs, and a successful login clears its counter.
  const ipLimit = checkRateLimit(`login:ip:${clientIp(request)}`, 20, 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterMs);

  const emailKey = `login:email:${parsed.data.email.toLowerCase()}`;
  const locked = isLoginLocked(emailKey);
  if (locked.locked) return rateLimitResponse(locked.retryAfterMs);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const nowLocked = recordLoginFailure(emailKey);
    if (nowLocked.locked) return rateLimitResponse(nowLocked.retryAfterMs);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  clearLoginFailures(emailKey);

  // users.id = auth.users.id — the app account row gates login by is_active.
  const { data: userRow } = await supabase
    .from("users")
    .select("is_active, organization_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (userRow && !userRow.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "This account has been deactivated. Contact an administrator." },
      { status: 403 },
    );
  }

  // Audit: record the successful sign-in (best-effort — an invited user
  // whose users row isn't inserted yet has no org id to scope the log to).
  // Scheduled via after() so it runs once the response has been sent
  // instead of adding a sequential DB round trip to sign-in latency.
  if (userRow?.organization_id) {
    const organizationId = userRow.organization_id;
    after(() =>
      logAudit({
        supabase,
        organizationId,
        actorUserId: data.user.id,
        action: "login",
        targetEmail: data.user.email ?? undefined,
        request,
      }),
    );
  }

  return NextResponse.json({ success: true });
}
