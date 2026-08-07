"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2 } from "lucide-react";
import { deleteProfileCvRequest } from "@/lib/api/profiles-client";
import type { ProfileMutationResponse } from "@/lib/api/profiles-client";
import { Button } from "@/components/ui/button";

type CvEntry = {
  id: string;
  fileName: string;
  createdAt: string;
  downloadUrl: string | null;
};

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function DeleteCvButton({
  profileId,
  cv,
  onDeleted,
}: {
  profileId: string;
  cv: CvEntry;
  onDeleted: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  function armConfirmation() {
    setError(null);
    setIsConfirming(true);

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    confirmTimeoutRef.current = setTimeout(() => {
      setIsConfirming(false);
    }, 3000);
  }

  async function handleDelete() {
    if (isPending) {
      return;
    }

    if (!isConfirming) {
      armConfirmation();
      return;
    }

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    setIsPending(true);
    setError(null);

    const result: ProfileMutationResponse = await deleteProfileCvRequest(
      profileId,
      cv.id,
    );

    setIsPending(false);

    if (!result.success) {
      setError(result.error ?? "Failed to delete CV.");
      setIsConfirming(false);
      return;
    }

    onDeleted();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && (
        <p className="max-w-48 text-right text-xs leading-snug text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={
          isConfirming ? `Confirm deletion of ${cv.fileName}` : `Delete ${cv.fileName}`
        }
        className={
          isConfirming
            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:text-destructive"
        }
      >
        {isPending ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        {isConfirming && !isPending ? "Confirm?" : null}
      </Button>
    </div>
  );
}

export function ProfileCvList({
  cvs,
  profileId,
  isAdmin,
  onChanged,
}: {
  cvs: CvEntry[];
  profileId: string;
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();

  function handleDeleted() {
    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  }

  if (cvs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No CVs uploaded yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {cvs.map((cv) => (
        <li
          key={cv.id}
          className="overflow-hidden rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <FileText className="size-4" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {cv.fileName}
                </p>

                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Uploaded {formatUploadDate(cv.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {cv.downloadUrl && (
                <a
                  href={cv.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                >
                  <Download className="size-3.5" />
                  Download
                </a>
              )}

              {isAdmin && (
                <DeleteCvButton
                  profileId={profileId}
                  cv={cv}
                  onDeleted={handleDeleted}
                />
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
