"use client";

import { useEffect, useState, type ReactNode } from "react";
import { stageColor } from "@/lib/constants";
import { Tooltip } from "@/components/tooltip";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RCBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RCTooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

/* ════════════════════════════════════════════════════════════════════
   SHARED CHART COMPONENTS — dashboard + statistics tabs
   ────────────────────────────────────────────────────────────────────
   All charts render through recharts (v3). Styling resolves to the app's
   theme tokens (--brand-blue, --border, --muted-foreground, --font-mono)
   so the charts follow light/dark mode like the rest of the UI, and
   tooltips use a small popover-style shell matching the app's Tooltip.
   Recharts' built-in animations handle entrances.

   Tooltips: the anchored Tooltip component wraps HTML rows (donut
   legend); recharts' Tooltip (with custom content) handles everything
   inside the chart canvases.
   ════════════════════════════════════════════════════════════════════ */

const ACCENT = "var(--brand-blue)";
const TICK_COLOR = "var(--muted-foreground)";
const GRID_STROKE = "var(--border)";
const MONO = "var(--font-mono)";

// Gridlines at 25% steps of the data max — the same hairline grid the
// custom charts drew, now via explicit YAxis ticks so recharts renders
// exactly those positions.
function gridTicks(max: number) {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
}

/** True when the user prefers reduced motion — recharts' built-in
 *  animations are then disabled (guideline: honor prefers-reduced-motion). */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Recharts' default 1500ms entrance is sluggish; 700ms keeps the motion
// alive without feeling heavy.
const ANIM_MS = 700;

/* ── Tooltip shell + content renderers ──────────────────────────────
   Recharts passes { active, payload, label } to custom content. The
   shell mirrors the app's popover tooltip look. */

function TipShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-sm">
      {children}
    </div>
  );
}

function unitWord(v: number, unit: string) {
  return `${v} ${unit}${v === 1 ? "" : "s"}`;
}

/** Line/area tooltip: bucket label + value. */
function LineTip({ active, payload, label, unit }: { active?: boolean; payload?: { value?: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value ?? 0;
  return (
    <TipShell>
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{unitWord(v, unit)}</span>
      </span>
    </TipShell>
  );
}

/** Stacked bar tooltip: bucket label + every member (color + name +
 *  count) + the bucket total. */
function StackedTip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; fill?: string }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0);
  const total = rows.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <TipShell>
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{label}</span>
        {rows.map((p) => (
          <span key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
            <span>{p.name}</span>
            <span className="font-mono ml-auto">{p.value}</span>
          </span>
        ))}
        <span className="text-muted-foreground mt-0.5">{unitWord(total, unit)} total</span>
      </span>
    </TipShell>
  );
}

/* ── Pipeline distribution ───────────────────────────────────────────
   Rows are the DB stages in order; each row shows the count of leads
   CURRENTLY in that stage. Horizontal bars colored by the stage's
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
  const data = stages.map((s, i) => ({
    name: s.name,
    value: counts[i],
    fill: colors?.[i] ?? stageColor(i),
  }));
  const reducedMotion = usePrefersReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={stages.length * 44}>
      <RCBarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 4 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} vertical={false} />
        <XAxis type="number" hide domain={[0, max]} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickLine={false}
          axisLine={false}
          // Default right-aligned ticks keep every stage name inside the
          // axis — a custom tick previously overflowed the chart and got
          // clipped. The bar itself carries the stage color.
          tick={{ fontSize: 12, fill: "var(--foreground)", fontWeight: 500 }}
        />
        <RCTooltip
          content={({ active, payload: p }: TooltipContentProps) => {
            if (!active || !p?.length) return null;
            const raw = p[0].value;
            const v = typeof raw === "number" ? raw : Number(raw) || 0;
            const share = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <TipShell>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground">{p[0].name}</span>
                  <span className="text-muted-foreground">
                    {unitWord(v, "lead")} · {share}% of the pipeline
                  </span>
                </span>
              </TipShell>
            );
          }}
          cursor={{ fill: "transparent" }}
          // Above the card's own stacking (and the donut's center overlay),
          // so tooltips never render underneath neighboring content.
          wrapperStyle={{ zIndex: 30 }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={!reducedMotion} animationDuration={ANIM_MS}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
        <LabelList
          dataKey="value"
          position="right"
          formatter={(v) => (v === 0 ? "" : v)}
          style={{ fontSize: 12, fontWeight: 700, fill: "var(--foreground)", fontFamily: MONO }}
        />
      </RCBarChart>
    </ResponsiveContainer>
  );
}

/* ── Line chart (leads / applications over time) ─────────────────────
   Flat single-hue line over a hairline grid with a soft area fill.
   Points carry a tooltip with the bucket + value.

   Dense series (daily/weekly over a long window) grow the chart wider
   instead of cramming labels together: each bucket reserves a minimum
   pixel width, so the chart expands horizontally and the card scrolls. */
export function LineChart({
  data,
  labels,
  small = false,
  unit = "lead",
}: {
  data: number[];
  labels: string[];
  /** Compact axis labels — used by the Applied Jobs tab. */
  small?: boolean;
  /** Noun for tooltips, e.g. "application". */
  unit?: string;
}) {
  const max = Math.max(...data, 1);
  // Each bucket reserves a minimum pixel width so labels never cram; only
  // genuinely dense series (long daily/weekly windows) grow wider than the
  // card and scroll horizontally. Reasonable counts (monthly, short
  // windows) fit the card's width instead of forcing a scrollbar.
  const pxPerBucket = 38;
  const dense = data.length * pxPerBucket > 460;
  const chartData = data.map((v, i) => ({ label: labels[i], value: v }));
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative overflow-x-auto">
      <div style={dense ? { width: `${data.length * pxPerBucket}px`, minWidth: "100%" } : { width: "100%" }}>
        <ResponsiveContainer width="100%" height={132}>
          <AreaChart data={chartData} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeWidth={0.5} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: small ? 8 : 9, fill: TICK_COLOR, fontFamily: MONO }}
            />
            <YAxis hide domain={[0, max]} ticks={gridTicks(max)} />
            <RCTooltip content={<LineTip unit={unit} />} cursor={{ stroke: GRID_STROKE, strokeDasharray: "4 4" }} wrapperStyle={{ zIndex: 30 }} />
            <Area
              type="linear"
              dataKey="value"
              stroke={ACCENT}
              strokeWidth={2}
              fill="color-mix(in srgb, var(--brand-blue) 8%, transparent)"
              dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }}
              isAnimationActive={!reducedMotion}
              animationDuration={ANIM_MS}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Stacked bar chart (per-bucket breakdown by member) ──────────────
   One bar per time bucket; each bar stacks one segment per series
   (member), colored from the series palette. Hovering a whole bar opens
   ONE tooltip listing every stacked member (color dot + name + count)
   plus the bucket's total. */
export function StackedBarChart({
  labels,
  series,
  unit = "lead",
}: {
  labels: string[];
  /** One entry per member: color from the caller's palette, counts parallel
   *  to labels. Zero-count members are skipped — no segment, no tooltip row. */
  series: { name: string; color: string; counts: number[] }[];
  /** Noun used in the tooltip total row, e.g. "application". */
  unit?: string;
}) {
  const totalFor = (i: number) => series.reduce((s, sr) => s + (sr.counts[i] ?? 0), 0);
  const max = Math.max(...labels.map((_, i) => totalFor(i)), 1);
  const chartData = labels.map((l, i) => {
    const row: Record<string, string | number> = { label: l };
    for (const sr of series) row[sr.name] = sr.counts[i] ?? 0;
    return row;
  });
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="flex flex-col">
      {/* Total per bucket, aligned above each bar */}
      <div className="flex gap-2">
        {labels.map((l, i) => {
          const total = totalFor(i);
          return (
            <div key={i} className={`flex-1 text-center font-mono text-micro text-muted-foreground font-semibold ${total > 0 ? "visible" : "invisible"}`}>{total}</div>
          );
        })}
      </div>
      {/* Plot area — one continuous 25%-step gridline background, bars
          stacked above the baseline */}
      <div className="relative h-[120px] mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <RCBarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID_STROKE} strokeWidth={0.5} />
            <XAxis dataKey="label" hide />
            <YAxis hide domain={[0, max]} ticks={gridTicks(max)} />
            <RCTooltip content={<StackedTip unit={unit} />} cursor={{ fill: "transparent" }} wrapperStyle={{ zIndex: 30 }} />
            {series.map((sr, i) => (
              <Bar
                key={sr.name}
                dataKey={sr.name}
                stackId="1"
                fill={sr.color}
                // Round only the topmost segment of the stack.
                radius={i === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={56}
                isAnimationActive={!reducedMotion}
                animationDuration={ANIM_MS}
              />
            ))}
          </RCBarChart>
        </ResponsiveContainer>
      </div>
      {/* Bucket labels — one per bar */}
      <div className="flex gap-2 mt-1">
        {labels.map((l, i) => (
          <div key={i} className="flex-1 text-center font-mono text-micro text-muted-foreground">{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut chart (status breakdown) ──────────────────────────────────
   One color per segment — the caller passes the stage's color, so the
   donut matches the rest of the app's stage color-coding. Segments
   sweep in on mount; the center shows the total, the legend rows are
   HTML (with the anchored Tooltip for the same breakdown). */
export function DonutChart({ segments }: { segments: { label: string; value: number; color?: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const data = segments.map((seg) => ({ name: seg.label, value: seg.value, fill: seg.color ?? ACCENT }));
  const reducedMotion = usePrefersReducedMotion();

  const donutTip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    const raw = p.value;
    const v = typeof raw === "number" ? raw : Number(raw) || 0;
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    return (
      <TipShell>
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">{p.name}</span>
          <span className="text-muted-foreground">
            {unitWord(v, "lead")} ({pct}%)
          </span>
        </span>
      </TipShell>
    );
  };

  return (
    <div className="relative flex items-center gap-5">
      <div className="relative shrink-0">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <RCTooltip content={donutTip} wrapperStyle={{ zIndex: 30 }} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={34}
              outerRadius={52}
              paddingAngle={2}
              cornerRadius={2}
              strokeWidth={0}
              isAnimationActive={!reducedMotion}
              animationDuration={ANIM_MS}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-lg font-bold text-foreground">{total}</div>
          <div className="font-mono text-nano text-muted-foreground">TOTAL</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.75">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <Tooltip
              key={s.label}
              content={
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">
                    {unitWord(s.value, "lead")} ({pct}%)
                  </span>
                </span>
              }
            >
              <div className="flex items-center gap-2 cursor-default">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color ?? ACCENT }} />
                <span className="text-xs text-foreground">{s.label}</span>
                <span className="font-mono text-meta text-muted-foreground ml-auto">{s.value}</span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
