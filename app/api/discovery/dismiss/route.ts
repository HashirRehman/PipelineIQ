import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/api/guard";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { dismissJobSchema } from "@/lib/validation/schemas";

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

  const parsed = dismissJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("dismiss_job_profile", {
    p_job_id: parsed.data.jobId,
    p_profile_id: parsed.data.profileId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    if (error.code === "P0001") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("api/discovery/dismiss: dismiss_job_profile rpc failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
