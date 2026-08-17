"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveProfileRequest } from "@/lib/api/profiles-client";

// Soft-deletes the profile. Two-step inline confirm (like CV deletion) so an
// archive can't be triggered by a stray click; the confirmation times out
// after 3 seconds.
export function ProfileArchiveButton({
  profileId,
  onArchived,
}: {
  profileId: string;
  onArchived: () => void;
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

  async function handleArchive() {
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

    const result = await archiveProfileRequest(profileId);

    setIsPending(false);

    if (!result.success) {
      setError(result.error ?? "Failed to archive profile.");
      setIsConfirming(false);
      return;
    }

    onArchived();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant={isConfirming ? "destructive" : "ghost"}
        size="sm"
        onClick={handleArchive}
        disabled={isPending}
        aria-label={
          isConfirming ? "Confirm archiving profile" : "Archive profile"
        }
      >
        {isConfirming ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {isConfirming ? "Confirm archive?" : "Archive"}
      </Button>
    </div>
  );
}
