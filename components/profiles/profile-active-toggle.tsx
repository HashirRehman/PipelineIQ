"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProfileActiveRequest } from "@/lib/api/profiles-client";
import { cn } from "@/lib/utils";

export function ProfileActiveToggle({
  profileId,
  isActive,
  onChanged,
}: {
  profileId: string;
  isActive: boolean;
  onChanged?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [displayActive, setDisplayActive] = useState(isActive);
  const [prevIsActive, setPrevIsActive] = useState(isActive);
  const router = useRouter();

  if (!isPending && isActive !== prevIsActive) {
    setPrevIsActive(isActive);
    setDisplayActive(isActive);
  }

  const handleToggle = async () => {
    if (isPending) {
      return;
    }

    const next = !displayActive;

    setError(null);
    setIsPending(true);
    setDisplayActive(next); // optimistic — switch reflects intent

    const result = await setProfileActiveRequest(profileId, next);

    setIsPending(false);

    if (!result.success) {
      setDisplayActive(!next); // revert on failure
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    if (onChanged) {
      onChanged();
    } else {
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={displayActive}
        aria-label={displayActive ? "Deactivate profile" : "Activate profile"}
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          displayActive ? "bg-primary" : "bg-muted dark:bg-white/40",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-primary-foreground shadow-sm transition-transform",
            displayActive ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
