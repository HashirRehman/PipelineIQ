"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import type { JobCommentDto } from "@/app/api/jobs/[jobId]/comments/route";
import { apiDelete, apiPatch, apiPost, withOrgId } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";

const inputClass =
  "w-full border p-2 bg-muted/40 border-border rounded-md text-foreground text-xs resize-none outline-none mb-2 focus:border-primary";

function CommentRow({
  comment,
  currentUserId,
  onEdited,
  onDeleted,
}: {
  comment: JobCommentDto;
  currentUserId: string | null;
  onEdited: (comment: JobCommentDto) => void;
  onDeleted: (id: string) => void;
}) {
  const isOwn = currentUserId !== null && comment.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveEdit = async () => {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      setDraft(comment.body);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPatch<{ success: boolean }>(`/api/comments/${comment.id}`, { body });
      onEdited({ ...comment, body, updatedAt: new Date().toISOString() });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiDelete<{ success: boolean }>(`/api/comments/${comment.id}`);
      onDeleted(comment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex items-start gap-2.5">
        <Avatar name={comment.authorName} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
            {isOwn && <span className="text-meta text-muted-foreground">(you)</span>}
            <span className="text-meta text-muted-foreground">{timeAgo(comment.createdAt)}</span>
          </div>

          {editing ? (
            <>
              <textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={inputClass}
                autoFocus
              />
              {error && <p className="text-meta text-destructive mb-1">{error}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={saveEdit}
                  disabled={busy || !draft.trim()}
                  className="rounded-md px-3 text-xs hover:bg-primary/90"
                >
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditing(false); setDraft(comment.body) }}
                  className="rounded-md px-3 text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {error && <p className="text-meta text-destructive mb-1">{error}</p>}
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{comment.body}</p>
              {isOwn && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                    className="h-auto gap-1 rounded px-1.5 py-0.5 text-meta text-muted-foreground hover:bg-accent"
                  >
                    <Pencil className="size-3" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={remove}
                    className="h-auto gap-1 rounded px-1.5 py-0.5 text-meta text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3" /> Delete
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobComments({ jobId }: { jobId: string }) {
  const [comments, setComments] = useState<JobCommentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(withOrgId(`/api/jobs/${encodeURIComponent(jobId)}/comments`), {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load comments");
        return res.json() as Promise<{ comments: JobCommentDto[] }>;
      })
      .then((json) => {
        setComments(json.comments);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to load comments.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    const client = createClient();
    client.auth.getUser().then(({ data }) => {
      if (!cancelled) setCurrentUserId(data?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const json = await apiPost<{ success: boolean; comment: JobCommentDto }>(
        `/api/jobs/${encodeURIComponent(jobId)}/comments`,
        { body },
      );
      setComments((cs) => [...cs, json.comment]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      {/* Composer */}
      <textarea
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a comment…"
        className={inputClass}
      />
      {error && <p className="text-meta text-destructive mb-1">{error}</p>}
      <div className="flex justify-end mb-3">
        <Button
          type="button"
          size="sm"
          onClick={post}
          disabled={posting || !draft.trim()}
          className="gap-1.5 rounded-md px-3 text-xs hover:bg-primary/90"
        >
          <MessageSquare className="size-3.5" />
          {posting ? "Posting…" : "Comment"}
        </Button>
      </div>

      {/* Thread (flat) */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-meta text-muted-foreground text-center py-4">
          No comments yet. Start the discussion.
        </p>
      ) : (
        <div className="flex flex-col">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onEdited={(updated) => setComments((cs) => cs.map((c) => (c.id === updated.id ? updated : c)))}
              onDeleted={(id) => setComments((cs) => cs.filter((c) => c.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
