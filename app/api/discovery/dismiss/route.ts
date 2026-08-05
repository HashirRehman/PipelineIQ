import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/api/guard";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { dismissMatchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = dismissMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("job_engineer_matches")
    .update({ status: "dismissed", dismissed_reason: parsed.data.reason })
    .eq("id", parsed.data.matchId)
    .select("id");

  if (error) {
    console.error("api/discovery/dismiss: job_engineer_matches update failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Match not found or not accessible." }, { status: 404 });
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
