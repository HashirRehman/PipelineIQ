"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption, TooltipComponentFormatterCallbackParams } from "echarts";
import { echarts } from "./echarts-setup";
import { useThemeColors, usePrefersReducedMotion, unitWord, resolveColor } from "./chart-theme";

interface Series {
  name: string;
  color: string;
  counts: number[];
}

/* Per-bucket breakdown by member — one bar per time bucket, each bar
   stacking one segment per series (member), colored from the caller's
   palette. Hovering a whole bar opens ONE tooltip listing every stacked
   member (color dot + name + count) plus the bucket's total. */
export function StackedBarChart({
  labels,
  series,
  unit = "lead",
}: {
  labels: string[];
  /** One entry per member: color from the caller's palette, counts parallel
   *  to labels. Zero-count members are skipped — no segment, no tooltip row. */
  series: Series[];
  /** Noun used in the tooltip total row, e.g. "application". */
  unit?: string;
}) {
  const colors = useThemeColors();
  const reducedMotion = usePrefersReducedMotion();

  // Callers rebuild `series` (a fresh array of fresh objects) on every
  // render even when the underlying counts haven't changed, which would
  // defeat a reference-equality useMemo. Keying the memo on a content
  // fingerprint instead means the chart only actually rebuilds its
  // option when the numbers genuinely changed.
  const seriesKey = JSON.stringify(series);
  const labelsKey = JSON.stringify(labels);

  const option: EChartsOption = useMemo(() => {
    const totalFor = (i: number) => series.reduce((s, sr) => s + (sr.counts[i] ?? 0), 0);
    return {
      grid: { top: 12, right: 12, bottom: 24, left: 12, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: colors.grid } },
        axisTick: { show: false },
        axisLabel: { fontSize: 9, color: colors.tick, fontFamily: colors.mono },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 9, color: colors.tick, fontFamily: colors.mono },
        splitLine: { lineStyle: { color: colors.grid, width: 0.5 } },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: colors.popoverBg,
        borderColor: colors.popoverBorder,
        borderWidth: 1,
        textStyle: { color: colors.popoverFg, fontSize: 12 },
        formatter: (raw: TooltipComponentFormatterCallbackParams) => {
          const arr = Array.isArray(raw) ? raw : [raw];
          const idx = typeof arr[0]?.dataIndex === "number" ? arr[0].dataIndex : 0;
          const rows = series.filter((sr) => (sr.counts[idx] ?? 0) > 0);
          const total = totalFor(idx);
          const rowsHtml = rows
            .map(
              (sr) =>
                `<div style="display:flex;align-items:center;gap:6px;">
                   <span style="width:8px;height:8px;border-radius:9999px;background:${sr.color};display:inline-block;"></span>
                   <span>${sr.name}</span>
                   <span style="font-family:${colors.mono};margin-left:auto;">${sr.counts[idx] ?? 0}</span>
                 </div>`,
            )
            .join("");
          return `<div style="font-weight:600;margin-bottom:2px;">${labels[idx]}</div>
             ${rowsHtml}
             <div style="color:${colors.mutedFg};margin-top:2px;">${unitWord(total, unit)} total</div>`;
        },
      },
      series: series.map((sr, i) => ({
        name: sr.name,
        type: "bar" as const,
        stack: "total",
        data: sr.counts,
        barMaxWidth: 56,
        barCategoryGap: "28%",
        itemStyle: {
          color: resolveColor(sr.color),
          borderRadius: i === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0],
        },
      })),
      animation: !reducedMotion,
      animationDuration: 500,
      animationEasing: "cubicOut",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey, labelsKey, unit, colors, reducedMotion]);

  return (
    <div className="h-[140px]">
      <ReactEChartsCore echarts={echarts} option={option} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
