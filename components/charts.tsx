"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { stageColor } from "@/lib/constants";
import { Tooltip } from "@/components/tooltip";

/* ════════════════════════════════════════════════════════════════════
   SHARED CHART COMPONENTS — dashboard + statistics tabs
   ────────────────────────────────────────────────────────────────────
   Flat fills (no inner gradients/shadows). Entrances use pure-CSS
   keyframes defined in app/globals.css (chart-grow-up / chart-grow-x /
   chart-fade-in / chart-pop / chart-sweep / chart-draw) with
   animation-delay for the stagger — no animation library on the client,
   and prefers-reduced-motion is handled by the global reduced-motion
   rule. Animations play on mount (the keyed containers replay them when
   the data window changes).

   Tooltips: HTML rows (funnel, bar columns) use the anchored Tooltip
   component; SVG points (line, donut segments) can't be wrapped in an
   HTML span, so they use a lightweight cursor-following tooltip.
   ════════════════════════════════════════════════════════════════════ */

const ACCENT = "var(--brand-blue)";

/** Cursor-following tooltip for SVG elements — position is tracked by the
 *  caller's onMouseMove handlers and rendered here as a fixed bubble. */
function ChartTip({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[280px] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-sm animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y, transform: "translate(-50%, calc(-100% - 10px))" }}
    >
      {text}
    </div>
  );
}

/* ── Pipeline distribution ───────────────────────────────────────────
   Rows are the DB stages in order; each row shows the count of leads
   CURRENTLY in that stage. Bars are flat, colored by the stage's
   position in the ordered pipeline (see STAGE_PALETTE). There is no
   "carry-through %" — the leads table stores only a lead's current
   stage, not its history, so retention percentages would be a ratio of
   two independent snapshots, not real conversion. Counts only. */
export function FunnelChart({
  stages,
  counts,
  colors,
}: {
  stages: { id: string; name: string; orderIndex: number }[];
  counts: number[];
  /** Per-row color, parallel to stages. Defaults to the stage's position
   * color — pass explicit colors when rows are a filtered subset so each
   * stage keeps its original pipeline color. */
  colors?: string[];
}) {
  const max = Math.max(...counts, 1);
  const total = counts.reduce((s, c) => s + c, 0);

  return (
    <div className="flex flex-col">
      {stages.map((s, i) => {
        const color = colors?.[i] ?? stageColor(i);
        const share = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <Tooltip
            key={s.id}
            wrapperClassName="w-full"
            content={
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {counts[i]} lead{counts[i] === 1 ? "" : "s"} · {share}% of the pipeline
                </span>
              </span>
            }
          >
            <div
              className={cn(
                "flex items-center gap-3 py-2.75",
                i < stages.length - 1 && "border-b border-border",
              )}
            >
              <div className="w-[150px] shrink-0 flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} aria-hidden />
                <span className="text-xs font-medium truncate text-foreground">{s.name}</span>
              </div>
              <div className="flex-1 h-2.5 rounded-sm overflow-hidden bg-muted">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(counts[i] / max) * 100}%`,
                    background: color,
                    opacity: counts[i] > 0 ? 1 : 0.35,
                    animation: "chart-grow-x 0.5s ease-out backwards",
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              </div>
              <div className="w-[48px] shrink-0 text-right font-mono text-xs font-bold text-foreground">{counts[i]}</div>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* ── Line chart (leads over time) ────────────────────────────────────
   Flat single-hue line over a hairline grid. The line draws itself in
   via a stroke-dashoffset keyframe (pathLength normalized to 1), the
   soft area fill fades up behind it, and points pop in sequence.
   Keyed by the data so switching granularity replays the animation.
   Points carry a cursor-following tooltip with the bucket + value.

   Dense series (daily/weekly over a long window) grow the chart wider
   instead of cramming labels together: each bucket reserves a minimum
   pixel width, so the SVG expands horizontally and the card scrolls. */
export function LineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const max = Math.max(...data, 1);
  // Minimum horizontal space per bucket (rendered px). The viewBox width
  // matches the rendered width, so geometry/text stay at a consistent size
  // whether the chart fills its card or expands into a scrollable width.
  const pxPerBucket = 38;
  // Extra space on each side so the first/last labels (centered on their
  // points) are never clipped by the scroll container — ~half the widest
  // label ("Dec 31" at --text-micro) plus a small gap.
  const edge = 26;
  const plotW = Math.max(400 - edge * 2, data.length * pxPerBucket);
  const w = plotW + edge * 2;
  const h = 100;
  const pad = { l: 8, r: 8, t: 10, b: 0 };
  const innerW = plotW - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const plotLeft = edge + pad.l;
  const plotRight = edge + pad.l + innerW;

  // A single bucket (monthly + "Last month") has no line or area to draw —
  // just center the point so the value still shows.
  const single = data.length <= 1;
  const pts = data.map((v, i) => ({
    x: plotLeft + (single ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.t + (1 - v / max) * innerH,
  }));

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fill = single ? null : `${path} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;
  const chartKey = data.join("-");

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h + 20}`}
        style={{ width: `${w}px`, minWidth: "100%", height: "auto" }}
        className="block overflow-visible"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={plotLeft} y1={pad.t + f * innerH} x2={plotRight} y2={pad.t + f * innerH}
            stroke="var(--border)" strokeWidth="0.5" />
        ))}
        {fill && (
          <path
            key={`area-${chartKey}`}
            d={fill}
            fill="color-mix(in srgb, var(--brand-blue) 8%, transparent)"
            style={{ animation: "chart-fade-in 0.6s ease-out 0.35s backwards" }}
          />
        )}
        {!single && (
          <path
            key={`line-${chartKey}`}
            d={path}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{ animation: "chart-draw 0.9s ease-out backwards" }}
          />
        )}
        {pts.map((p, i) => (
          <circle
            key={`pt-${chartKey}-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={ACCENT}
            className="cursor-pointer"
            onMouseEnter={(e) =>
              setTip({ x: e.clientX, y: e.clientY, text: `${labels[i]}: ${data[i]} lead${data[i] === 1 ? "" : "s"}` })
            }
            onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
            onMouseLeave={() => setTip(null)}
            style={{
              animation: "chart-pop 0.25s ease-out backwards",
              animationDelay: `${0.45 + i * 0.04}s`,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />
        ))}
        {labels.map((l, i) => (
          <text key={i} x={pts[i].x} y={h + 16} textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-mono)" }}>{l}</text>
        ))}
      </svg>
      {tip ? <ChartTip x={tip.x} y={tip.y} text={tip.text} /> : null}
    </div>
  );
}

/* ── Bar chart ───────────────────────────────────────────────────────
   Flat bars that grow up from the baseline with a light stagger. Each
   series can carry its own professional color (per user / per profile);
   default is brand blue. Keyed by the data so the entrance replays when
   the window changes. Bars carry an anchored tooltip with label + value. */
export function BarChart({
  data,
  labels,
  color = ACCENT,
}: {
  data: number[];
  labels: string[];
  color?: string;
}) {
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-2 h-[152px]">
      {data.map((v, i) => (
        <Tooltip
          key={i}
          wrapperClassName="flex-1 h-full"
          content={
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground">{labels[i]}</span>
              <span className="text-muted-foreground">
                {v} lead{v === 1 ? "" : "s"}
              </span>
            </span>
          }
        >
          <div className="h-full flex flex-col items-center gap-1">
            <div className={`font-mono text-micro text-muted-foreground font-semibold ${v > 0 ? "visible" : "invisible"}`}>{v}</div>
            <div className="w-full relative h-[120px] flex items-end">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(v / max) * 100}%`,
                  minHeight: v > 0 ? 4 : 0,
                  background: color,
                  animation: "chart-grow-up 0.5s ease-out backwards",
                  animationDelay: `${i * 0.04}s`,
                }}
              />
            </div>
            <div className="font-mono text-micro text-muted-foreground text-center">{labels[i]}</div>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

/* ── Donut chart (status breakdown) ──────────────────────────────────
   One color per segment — the caller passes the stage's color, so the
   donut matches the rest of the app's stage color-coding. Segments
   sweep in sequentially from 12 o'clock (stroke-dasharray keyframe with
   pathLength normalized to 1) with a hairline gap between them.
   Segments and legend rows carry cursor-following tooltips. */
export function DonutChart({ segments }: { segments: { label: string; value: number; color?: string }[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 52;
  const cx = 70;
  const cy = 70;
  const thickness = 18;
  const gap = 0.006; // fractional gap between segments

  const arcs = segments.reduce<{ label: string; value: number; color?: string; frac: number; start: number }[]>((acc, seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const start = acc.length === 0 ? 0 : acc[acc.length - 1].start + acc[acc.length - 1].frac;
    acc.push({ ...seg, frac, start });
    return acc;
  }, []);

  const textFor = (seg: { label: string; value: number }) => {
    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
    return `${seg.label}: ${seg.value} lead${seg.value === 1 ? "" : "s"} (${pct}%)`;
  };

  return (
    <div className="relative flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {arcs.map((seg) => (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color ?? ACCENT}
              strokeWidth={thickness}
              pathLength={1}
              strokeDasharray={`${Math.max(seg.frac - gap, 0)} ${1 - Math.max(seg.frac - gap, 0)}`}
              strokeDashoffset={-seg.start}
              className="cursor-pointer"
              onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, text: textFor(seg) })}
              onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
              onMouseLeave={() => setTip(null)}
              style={{ animation: "chart-sweep 0.7s ease-out backwards" }}
            />
          ))}
        </g>
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--page-fg)" style={{ fontSize: "var(--text-lg)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: "var(--text-nano)", fontFamily: "var(--font-mono)" }}>TOTAL</text>
      </svg>
      <div className="flex flex-col gap-1.75">
        {segments.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 cursor-default"
            onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, text: textFor(s) })}
            onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
            onMouseLeave={() => setTip(null)}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color ?? ACCENT }} />
            <span className="text-xs text-foreground">{s.label}</span>
            <span className="font-mono text-meta text-muted-foreground ml-auto">{s.value}</span>
          </div>
        ))}
      </div>
      {tip ? <ChartTip x={tip.x} y={tip.y} text={tip.text} /> : null}
    </div>
  );
}
