"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProfileActiveRequest } from "@/lib/api/profiles-client";
import { Button } from "@/components/ui/button";

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const next = !displayActive;

    setError(null);
    setIsPending(true);
    setDisplayActive(next); // optimistic — button + next click reflect intent

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
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : displayActive ? "Deactivate" : "Activate"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
