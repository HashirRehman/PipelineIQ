"use client";

import { useEffect, useState } from "react";

/** True when the user prefers reduced motion — every chart disables its
 *  entrance animation when set (guideline: honor prefers-reduced-motion). */
export function usePrefersReducedMotion(): boolean {
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

export interface ThemeColors {
  accent: string;
  tick: string;
  grid: string;
  mono: string;
  foreground: string;
  popoverBg: string;
  popoverBorder: string;
  popoverFg: string;
  mutedFg: string;
}

function readThemeColors(): ThemeColors {
  if (typeof window === "undefined") {
    return {
      accent: "#2563eb",
      tick: "#64748b",
      grid: "#e2e8f0",
      mono: "ui-monospace",
      foreground: "#0f172a",
      popoverBg: "#ffffff",
      popoverBorder: "#e2e8f0",
      popoverFg: "#0f172a",
      mutedFg: "#64748b",
    };
  }
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    accent: v("--brand-blue", "#2563eb"),
    tick: v("--muted-foreground", "#64748b"),
    grid: v("--border", "#e2e8f0"),
    mono: v("--font-mono", "ui-monospace"),
    foreground: v("--foreground", "#0f172a"),
    popoverBg: v("--popover", "#ffffff"),
    popoverBorder: v("--border", "#e2e8f0"),
    popoverFg: v("--popover-foreground", "#0f172a"),
    mutedFg: v("--muted-foreground", "#64748b"),
  };
}

/** Re-reads the app's CSS custom properties whenever the resolved theme
 *  (light/dark, via the `.dark` class next-themes toggles on <html>)
 *  changes, so chart colors repaint on theme switch instead of freezing
 *  at whatever was current on first render. ECharts draws to canvas, so
 *  it can't reference var(--x) the way DOM/CSS can — colors have to be
 *  resolved to concrete strings up front. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readThemeColors);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

export function unitWord(v: number, unit: string): string {
  return `${v} ${unit}${v === 1 ? "" : "s"}`;
}

let resolveProbe: HTMLDivElement | null = null;

/** Resolves ANY CSS color expression — `var(--token)`, `color-mix(...)`,
 *  already-concrete hex/rgb — to its final computed RGB(A) string.
 *  The rest of the app hands colors straight to CSS (background,
 *  border, etc.), where `var(--brand-blue)` or a `color-mix(...)`
 *  expression just works — but ECharts' canvas renderer draws via the
 *  2D Canvas API, which has no concept of CSS custom properties or
 *  color functions: `ctx.fillStyle = "var(--brand-blue)"` silently
 *  resolves to black instead of throwing, which is why an unresolved
 *  var/color-mix reaching a chart series color reads as "this
 *  bar/segment/area is just black (or invisible)" rather than an
 *  obvious error. Works by setting the color on a detached, unattached
 *  probe element and reading back getComputedStyle — the browser does
 *  the actual CSS color resolution, so this handles any valid color
 *  syntax, not just the var() case. Every color that flows from
 *  lib/constants.ts (BRAND.*, STATUS.*, SERIES_PALETTE, stageColor(),
 *  …) or any color-mix()/var() literal into an ECharts option MUST pass
 *  through this first. */
export function resolveColor(color: string): string {
  if (typeof window === "undefined") return color;
  if (!color.includes("var(") && !color.includes("color-mix(")) return color;
  if (!resolveProbe) {
    resolveProbe = document.createElement("div");
    resolveProbe.style.display = "none";
    document.documentElement.appendChild(resolveProbe);
  }
  resolveProbe.style.color = color;
  const resolved = getComputedStyle(resolveProbe).color;
  return resolved || color;
}
