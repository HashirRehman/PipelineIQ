"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProfileActiveRequest } from "@/lib/api/profiles-client";
import { Switch } from "@/components/ui/switch";

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
      <Switch
        checked={displayActive}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={displayActive ? "Deactivate profile" : "Activate profile"}
        className="h-5 w-9 data-[unchecked]:bg-muted dark:data-[unchecked]:bg-white/40"
        thumbClassName="size-4 data-[checked]:translate-x-4"
      />
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
