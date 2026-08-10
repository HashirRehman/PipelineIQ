import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import { createCommentSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export type JobCommentDto = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

type CommentRow = {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  users: { full_name: string } | null;
};

function toDto(row: CommentRow): JobCommentDto {
  return {
    id: row.id,
    body: row.body,
    authorId: row.user_id,
    authorName: row.users?.full_name || "User",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COMMENT_SELECT = "id, body, user_id, created_at, updated_at, users(full_name)";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Job pages (comments live in the job drawer) are open to every role; the
  // gate stays as a named helper so a future restricted role only has to
  // change lib/auth/roles.ts.
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const { jobId } = await params;

  // The job must belong to the caller's org — comments are org-scoped.
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from("job_comments")
    .select(COMMENT_SELECT)
    .eq("organization_id", org.organizationId)
    .eq("job_id", jobId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("api/jobs/[jobId]/comments: query failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ comments: (rows ?? []).map(toDto) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Job pages (comments live in the job drawer) are open to every role; the
  // gate stays as a named helper so a future restricted role only has to
  // change lib/auth/roles.ts.
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const { jobId } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { data: inserted, error } = await supabase
    .from("job_comments")
    .insert({
      organization_id: org.organizationId,
      job_id: jobId,
      user_id: user.id,
      body: parsed.data.body,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    console.error("api/jobs/[jobId]/comments: insert failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  revalidatePath("/");
  return NextResponse.json({ success: true, comment: toDto(inserted) });
}
