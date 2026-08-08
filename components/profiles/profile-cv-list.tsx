"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2 } from "lucide-react";
import { deleteProfileCvRequest } from "@/lib/api/profiles-client";
import type { ProfileMutationResponse } from "@/lib/api/profiles-client";

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
        <p className="max-w-40 text-right text-xs leading-snug text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={
          isConfirming
            ? `Confirm deletion of ${cv.fileName}`
            : `Delete ${cv.fileName}`
        }
        className={[
          "flex size-7 items-center justify-center rounded transition-colors disabled:opacity-50 cursor-pointer",
          isConfirming
            ? "bg-destructive/10 text-destructive"
            : "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
        ].join(" ")}
      >
        {isPending ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
      {isConfirming && !isPending && (
        <span className="text-xs font-medium text-destructive">Confirm?</span>
      )}
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
      <p className="py-3 text-center text-xs text-muted-foreground">
        No CVs uploaded yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {cvs.map((cv) => (
        <li key={cv.id} className="flex items-center gap-3 py-2.5">
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {cv.fileName}
            </p>
            <p className="text-meta text-muted-foreground">
              {formatUploadDate(cv.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {cv.downloadUrl && (
              <a
                href={cv.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Download"
              >
                <Download className="size-3.5" />
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
        </li>
      ))}
    </ul>
  );
}
