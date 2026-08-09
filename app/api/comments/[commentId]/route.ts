import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedIsAdmin, getCachedUser } from "@/lib/supabase/server";
import { updateCommentSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const { commentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { data: comment } = await supabase
    .from("job_comments")
    .select("id, user_id")
    .eq("id", commentId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!comment) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  // Edits are author-only — anyone can comment, but only the author rewrites
  // their own words.
  if (comment.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the author can edit this comment." },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("job_comments")
    .update({ body: parsed.data.body })
    .eq("id", commentId);

  if (error) {
    console.error("api/comments/[commentId]: update failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  const { commentId } = await params;

  const isAdmin = await getCachedIsAdmin();

  const { data: comment } = await supabase
    .from("job_comments")
    .select("id, user_id")
    .eq("id", commentId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!comment) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  // Deletes are author-or-admin (moderation).
  if (comment.user_id !== user.id && !isAdmin) {
    return NextResponse.json(
      { error: "Only the author or an admin can delete this comment." },
      { status: 403 },
    );
  }

  // Soft-delete: history survives; the app hides deleted rows.
  const { error } = await supabase
    .from("job_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) {
    console.error("api/comments/[commentId]: delete failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
