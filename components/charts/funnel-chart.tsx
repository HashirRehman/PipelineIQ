"use client";

import { stageColor } from "@/lib/constants";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion, unitWord } from "./chart-theme";

interface Stage {
  id: string;
  name: string;
  orderIndex: number;
}

/* Pipeline distribution — rows are the DB stages in order; each row
   shows the count of leads CURRENTLY in that stage. Horizontal bars
   colored by the stage's position in the ordered pipeline (see
   STAGE_PALETTE). There is no "carry-through %" — the leads table
   stores only a lead's current stage, not its history, so retention
   percentages would be a ratio of two independent snapshots, not real
   conversion. Counts only.

   Deliberately plain HTML/CSS, not a canvas chart. A fixed number of
   stages used to make a chart library's auto-sized container safe, but
   stages are becoming admin-configurable (variable count), so a chart
   that must know its own height up front no longer fits. Plain flex
   rows size themselves and can sit in a scrollable, height-capped
   container with no coordination between the data and the container. */
export function FunnelChart({
  stages,
  counts,
  colors,
  /** Caps the visible rows before the list scrolls — keeps the card's
   * height stable regardless of how many stages the org has configured.
   * Omit to render every row uncapped (e.g. a dedicated full-page chart). */
  maxVisible,
}: {
  stages: Stage[];
  counts: number[];
  /** Per-row color, parallel to stages. Defaults to the stage's position
   * color — pass explicit colors when rows are a filtered subset so each
   * stage keeps its original pipeline color. */
  colors?: string[];
  maxVisible?: number;
}) {
  const max = Math.max(...counts, 1);
  const total = counts.reduce((s, c) => s + c, 0);
  const reducedMotion = usePrefersReducedMotion();
  const rowHeight = 40;

  return (
    <div
      className={cn("flex flex-col", maxVisible && stages.length > maxVisible && "overflow-y-auto overflow-x-hidden pr-1")}
      style={maxVisible ? { maxHeight: maxVisible * rowHeight } : undefined}
    >
      {stages.map((s, i) => {
        const value = counts[i] ?? 0;
        const fill = colors?.[i] ?? stageColor(i);
        const share = total > 0 ? Math.round((value / total) * 100) : 0;
        const pct = (value / max) * 100;
        return (
          <Tooltip
            key={s.id}
            side="top"
            wrapperClassName="block"
            content={
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {unitWord(value, "lead")} · {share}% of the pipeline
                </span>
              </span>
            }
          >
            <div
              className="group/row flex items-center gap-3 py-1.5"
              style={{ height: rowHeight }}
            >
              <span className="w-[152px] shrink-0 truncate text-right text-xs font-medium text-foreground" title={s.name}>
                {s.name}
              </span>
              <div className="relative h-2 min-w-0 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-[filter] duration-150 ease-out group-hover/row:brightness-110"
                  style={{
                    width: `${Math.max(pct, value > 0 ? 2 : 0)}%`,
                    background: fill,
                    animation: reducedMotion ? undefined : "chart-grow-x 0.6s ease-out backwards",
                    animationDelay: `${i * 0.04}s`,
                  }}
                />
              </div>
              <span className="w-7 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                {value > 0 ? value : ""}
              </span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
