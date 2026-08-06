"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEngineerActiveRequest } from "@/lib/api/engineers-client";
import { Button } from "@/components/ui/button";

export function EngineerActiveToggle({
  engineerId,
  isActive,
  onChanged,
}: {
  engineerId: string;
  isActive: boolean;
  onChanged?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setError(null);
    setIsPending(true);

    const result = await setEngineerActiveRequest(engineerId, !isActive);

    setIsPending(false);

    if (!result.success) {
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
        {isPending ? "Saving…" : isActive ? "Deactivate" : "Activate"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
