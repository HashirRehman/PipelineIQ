import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
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

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // users.id = auth.users.id — the app account row gates login by is_active.
  const { data: userRow } = await supabase
    .from("users")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (userRow && !userRow.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "This account has been deactivated. Contact an administrator." },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}
