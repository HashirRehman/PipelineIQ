"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption, TooltipComponentFormatterCallbackParams } from "echarts";
import { echarts } from "./echarts-setup";
import { useThemeColors, usePrefersReducedMotion, unitWord, resolveColor } from "./chart-theme";
import { Tooltip } from "@/components/tooltip";

interface Segment {
  label: string;
  value: number;
  color?: string;
}

/* Status breakdown — one color per segment (the caller passes the
   stage's color, so the donut matches the rest of the app's stage
   color-coding). The center shows the total; the legend rows are HTML
   (with the app's own anchored Tooltip) for the same breakdown. */
export function DonutChart({ segments }: { segments: Segment[] }) {
  const colors = useThemeColors();
  const reducedMotion = usePrefersReducedMotion();
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  // Callers rebuild `segments` fresh every render — fingerprint instead
  // of reference equality so the chart only rebuilds when values change.
  const segmentsKey = JSON.stringify(segments);

  const option: EChartsOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: colors.popoverBg,
        borderColor: colors.popoverBorder,
        borderWidth: 1,
        textStyle: { color: colors.popoverFg, fontSize: 12 },
        formatter: (raw: TooltipComponentFormatterCallbackParams) => {
          const p = Array.isArray(raw) ? raw[0] : raw;
          const v = typeof p.value === "number" ? p.value : Number(p.value) || 0;
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          return `${p.name}<br/>${unitWord(v, "lead")} (${pct}%)`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["49%", "74%"],
          center: ["50%", "50%"],
          padAngle: 2,
          itemStyle: { borderRadius: 2, borderWidth: 0 },
          label: { show: false },
          labelLine: { show: false },
          data: segments.map((seg) => ({
            name: seg.label,
            value: seg.value,
            itemStyle: { color: seg.color ? resolveColor(seg.color) : colors.accent },
          })),
        },
      ],
      animation: !reducedMotion,
      animationDuration: 500,
      animationEasing: "cubicOut",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentsKey, colors, reducedMotion, total]);

  return (
    <div className="relative flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
        <ReactEChartsCore echarts={echarts} option={option} style={{ width: "100%", height: "100%" }} />
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
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color ?? colors.accent }} />
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
