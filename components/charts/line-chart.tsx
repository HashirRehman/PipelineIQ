"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import { echarts } from "./echarts-setup";
import { useThemeColors, usePrefersReducedMotion, unitWord } from "./chart-theme";

/* Leads / applications over time — a flat single-hue line, no area
   fill. Points carry a tooltip with the bucket + value.

   Always fills the card's width — no horizontal scroll. Dense series
   (daily/weekly over a long window) thin out their axis labels instead
   of growing the chart wider (axisLabel.interval: "auto"). */
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
  const colors = useThemeColors();
  const reducedMotion = usePrefersReducedMotion();

  const option: EChartsOption = useMemo(() => {
    const max = Math.max(...data, 1);
    return {
      grid: { top: 12, right: 12, bottom: small ? 18 : 22, left: 12, containLabel: false },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: colors.grid } },
        axisTick: { show: false },
        axisLabel: { fontSize: small ? 8 : 9, color: colors.tick, fontFamily: colors.mono, interval: "auto" },
      },
      yAxis: {
        type: "value",
        min: 0,
        max,
        show: false,
        splitLine: { lineStyle: { color: colors.grid, width: 0.5 } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: colors.popoverBg,
        borderColor: colors.popoverBorder,
        borderWidth: 1,
        textStyle: { color: colors.popoverFg, fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: colors.grid, type: "dashed" } },
        valueFormatter: (value) => unitWord(Number(value) || 0, unit),
      },
      series: [
        {
          type: "line",
          data,
          symbol: "circle",
          symbolSize: 6,
          smooth: false,
          lineStyle: { color: colors.accent, width: 2 },
          itemStyle: { color: colors.accent },
          emphasis: { itemStyle: { color: colors.accent, borderWidth: 0 } },
        },
      ],
      animation: !reducedMotion,
      animationDuration: 500,
      animationEasing: "cubicOut",
    };
  }, [data, labels, small, unit, colors, reducedMotion]);

  return (
    <div style={{ width: "100%", height: 132 }}>
      <ReactEChartsCore echarts={echarts} option={option} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
