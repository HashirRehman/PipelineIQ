"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  /** Entrance delay (ms) — lets a row of cards stagger in. */
  delay?: number;
  /** Optional leading icon, shown in a tinted well above the label. */
  icon?: LucideIcon;
  /** Tint for the icon well — a CSS color value. Defaults to the brand accent. */
  accent?: string;
}

/** Counts a numeric value up from the previous value using rAF — a
 *  dependency-free replacement for an animation library. Honors
 *  prefers-reduced-motion (jumps straight to the value). */
function useCountUp(value: number): number {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Start at 0 so the value counts up from zero on first mount.
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    // 0ms duration = jump straight to the value (reduced motion / no change).
    const duration = reduceMotion || from === value ? 0 : 900;
    const tick = (now: number) => {
      if (cancelled) return;
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Safety net: rAF is throttled/paused when the tab or frame isn't
    // focused (background tabs, embedded previews), which would otherwise
    // leave the card stuck at its starting value forever. A timer at the
    // animation's end guarantees the final value is shown regardless.
    const settle = window.setTimeout(() => {
      setDisplay(value);
    }, duration + 100);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
  }, [value, reduceMotion]);

  return display;
}

export function StatCard({ label, value, sub, className, valueClassName, labelClassName, delay = 0, icon: Icon, accent = "var(--brand-blue)" }: StatCardProps) {
  const isNumber = typeof value === "number";
  // Hook is always called (rules-of-hooks); result only used for numeric values.
  const display = useCountUp(isNumber ? value : 0);
  return (
    <div
      style={{
        animation: "chart-rise 0.35s ease-out backwards",
        animationDelay: `${delay}ms`,
      }}
      className={cn(
        "group/stat flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3.5 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-caption font-medium uppercase tracking-wide text-muted-foreground", labelClassName)}>{label}</span>
        {Icon && (
          <div
            className="flex size-6 shrink-0 items-center justify-center rounded-md transition-transform duration-150 ease-out group-hover/stat:scale-105"
            style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
          >
            <Icon className="size-3.5" style={{ color: accent }} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={cn("font-mono text-2xl font-bold text-foreground tabular-nums tracking-tight leading-none", valueClassName)}>
        {isNumber ? display : value}
      </div>
      {sub && <div className="text-meta text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
