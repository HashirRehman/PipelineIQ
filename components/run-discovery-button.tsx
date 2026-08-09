"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import type { DiscoverySummary } from "@/lib/cron/discover-jobs";

type RunDiscoveryState = {
  status?: "completed" | "skipped" | "cooldown" | "error";
  summary?: DiscoverySummary;
  error?: string;
  nextRunAvailableAt?: string;
};

export function RunDiscoveryButton() {
  const [state, setState] = useState<RunDiscoveryState>({});
  const [isPending, setIsPending] = useState(false);

  const handleRun = async () => {
    setIsPending(true);
    setState({});
    try {
      const json = await apiPost<RunDiscoveryState>("/api/discovery/run");
      if (json.status === "error") {
        setState({ status: "error", error: json.error ?? "Something went wrong. Please try again." });
      } else {
        setState(json);
      }
    } catch {
      setState({ status: "error", error: "Something went wrong. Please try again." });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleRun} disabled={isPending}>
        {isPending ? "Running discovery… (can take up to ~30s)" : "Run Discovery Now"}
      </Button>

      {state.status === "skipped" && (
        <p role="status" className="text-sm text-muted-foreground">
          Already running — try again shortly.
        </p>
      )}

      {state.status === "cooldown" && state.nextRunAvailableAt && (
        <p role="status" className="text-sm text-muted-foreground">
          Next run available at{" "}
          {new Date(state.nextRunAvailableAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </p>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      {state.status === "completed" && state.summary && (
        <div className="w-full max-w-xs rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p>Sources processed: {state.summary.sourcesProcessed}</p>
          <p>Jobs upserted: {state.summary.jobsUpserted}</p>
          <p>Jobs enriched: {state.summary.jobsEnriched}</p>
          <p>Matches written: {state.summary.matchesWritten}</p>
        </div>
      )}
    </div>
  );
}
