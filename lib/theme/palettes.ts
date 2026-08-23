/* ════════════════════════════════════════════════════════════════════════
   🎨 THEME PALETTES — user-selectable color schemes
   ────────────────────────────────────────────────────────────────────────
   The app's entire theme is driven by the CSS variables in
   `app/globals.css` (`--background`, `--card`, `--primary`, `--foreground`,
   …). Tailwind's `@theme inline` maps its color utilities to those raw
   variables, so overriding them at runtime re-skins the WHOLE app with no
   component changes.

   A palette is just light + dark values for the core tokens. Selecting one:
   1. persists the palette id in localStorage,
   2. injects a `<style id="pipelineiq-palette-style">` block containing
      `:root { …light vars… }` and `:root.dark { …dark vars… }` overrides.
   Unlayered, appended last in <head>, it wins over the defaults while
   `:root.dark` also beats the `prefers-color-scheme` media fallback.

   ▶ Palettes are sourced from professional design systems: Tailwind CSS,
     Radix UI, Nord, Dracula, Solarized, and Catppuccin.
   ════════════════════════════════════════════════════════════════════════ */

import { organizationName } from "@/lib/constants"

export interface PaletteColors {
  pageBg: string
  background: string
  card: string
  sidebar: string
  popover: string
  foreground: string
  mutedForeground: string
  primary: string
  primaryForeground: string
  ring: string
  accent: string
  accentForeground: string
  secondary: string
  muted: string
  border: string
  borderStrong?: string
  input?: string
  brandNavy: string
  brandBlue: string
  brandSky: string
}

export interface ThemePalette {
  id: string
  name: string
  /** Professional source — e.g. "Tailwind CSS", "Radix UI" */
  source: string
  description: string
  light: PaletteColors
  dark: PaletteColors
}

export const DEFAULT_PALETTE_ID = "default"

export const STORAGE_KEY = "pipelineiq.theme.palette"

export const STYLE_ID = "pipelineiq-palette-style"

/** The app's built-in look — selecting this clears any palette override. */
const DEFAULT_PALETTE: ThemePalette = {
  id: DEFAULT_PALETTE_ID,
  name: organizationName,
  source: "Built-in",
  description: "The default PipelineIQ look. Neutral slate with a single blue accent.",
  light: {
    pageBg: "#f8fafc",
    background: "#ffffff",
    card: "#ffffff",
    sidebar: "#f8fafc",
    popover: "#ffffff",
    foreground: "#0f172a",
    mutedForeground: "#64748b",
    primary: "#2563eb",
    primaryForeground: "#ffffff",
    ring: "#2563eb",
    accent: "#eff6ff",
    accentForeground: "#1d4ed8",
    secondary: "#f1f5f9",
    muted: "#f1f5f9",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    input: "#e2e8f0",
    brandNavy: "#44475a",
    brandBlue: "#3b82f6",
    brandSky: "#7dd3fc",
  },
  dark: {
    pageBg: "#020617",
    background: "#0f172a",
    card: "#0f172a",
    sidebar: "#020617",
    popover: "#0f172a",
    foreground: "#f1f5f9",
    mutedForeground: "#94a3b8",
    primary: "#3b82f6",
    primaryForeground: "#ffffff",
    ring: "#3b82f6",
    accent: "#172554",
    accentForeground: "#93c5fd",
    secondary: "#1e293b",
    muted: "#1e293b",
    border: "#1e293b",
    borderStrong: "#334155",
    input: "#1e293b",
    /* Light-mode navy (#44475a) is dark-on-dark here — lift it so the first
       pipeline stage stays readable in dark mode. */
    brandNavy: "#99a1b8",
    brandBlue: "#3b82f6",
    brandSky: "#93c5fd",
  },
}

/* ── Professional palettes ───────────────────────────────────────────────
   Light + dark token sets for the same core variables. Hex values used for
   readability; oklch works too. */

/** Tailwind CSS — Indigo */
const INDIGO: ThemePalette = {
  id: "indigo",
  name: "Indigo",
  source: "Tailwind CSS",
  description: "Classic indigo primary over cool slate neutrals.",
  light: {
    pageBg: "#f4f5f7", background: "#ffffff", card: "#ffffff",
    sidebar: "#ffffff", popover: "#ffffff",
    foreground: "#1e293b", mutedForeground: "#64748b",
    primary: "#4f46e5", primaryForeground: "#ffffff", ring: "#4f46e5",
    accent: "#eef2ff", accentForeground: "#4338ca",
    secondary: "#f1f5f9", muted: "#f1f5f9",
    border: "#e2e8f0", borderStrong: "#cbd5e1", input: "#e2e8f0",
    brandNavy: "#3730a3", brandBlue: "#4f46e5", brandSky: "#6366f1",
  },
  dark: {
    pageBg: "#0b1120", background: "#0f172a", card: "#1e293b",
    sidebar: "#172033", popover: "#1e293b",
    foreground: "#e2e8f0", mutedForeground: "#94a3b8",
    primary: "#818cf8", primaryForeground: "#0f172a", ring: "#818cf8",
    accent: "#1e1b4b", accentForeground: "#c7d2fe",
    secondary: "#1e293b", muted: "#1e293b",
    border: "#334155", borderStrong: "#475569", input: "#334155",
    brandNavy: "#312e81", brandBlue: "#6366f1", brandSky: "#818cf8",
  },
}

/** Radix UI — Violet */
const VIOLET: ThemePalette = {
  id: "violet",
  name: "Violet",
  source: "Radix UI",
  description: "Soft violet primary with muted mauve surfaces.",
  light: {
    pageBg: "#f7f6fa", background: "#ffffff", card: "#ffffff",
    sidebar: "#ffffff", popover: "#ffffff",
    foreground: "#211f26", mutedForeground: "#6e6a76",
    primary: "#6e56cf", primaryForeground: "#ffffff", ring: "#6e56cf",
    accent: "#f4f0fb", accentForeground: "#5b44ad",
    secondary: "#f1f0f4", muted: "#f1f0f4",
    border: "#e6e4ec", borderStrong: "#c9c6d2", input: "#e6e4ec",
    brandNavy: "#4a3a8a", brandBlue: "#6e56cf", brandSky: "#9e8cfc",
  },
  dark: {
    pageBg: "#131017", background: "#17141f", card: "#211d2b",
    sidebar: "#1b1824", popover: "#211d2b",
    foreground: "#f0eef2", mutedForeground: "#8f8a99",
    primary: "#9e8cfc", primaryForeground: "#17141f", ring: "#9e8cfc",
    accent: "#2a2440", accentForeground: "#cfc7f6",
    secondary: "#211d2b", muted: "#211d2b",
    border: "#383344", borderStrong: "#4b4559", input: "#383344",
    brandNavy: "#4a3a8a", brandBlue: "#9e8cfc", brandSky: "#c4b5fd",
  },
}

/** Tailwind CSS — Sky (Ocean) */
const OCEAN: ThemePalette = {
  id: "ocean",
  name: "Ocean",
  source: "Tailwind CSS",
  description: "Bright sky blue primary over airy light surfaces.",
  light: {
    pageBg: "#f0f7fb", background: "#ffffff", card: "#ffffff",
    sidebar: "#ffffff", popover: "#ffffff",
    foreground: "#0f172a", mutedForeground: "#64748b",
    primary: "#0284c7", primaryForeground: "#ffffff", ring: "#0284c7",
    accent: "#e0f2fe", accentForeground: "#0369a1",
    secondary: "#f0f9ff", muted: "#f0f9ff",
    border: "#bae6fd", borderStrong: "#7dd3fc", input: "#bae6fd",
    brandNavy: "#0c4a6e", brandBlue: "#0284c7", brandSky: "#38bdf8",
  },
  dark: {
    pageBg: "#0b1521", background: "#0f172a", card: "#16233a",
    sidebar: "#131d30", popover: "#16233a",
    foreground: "#e2e8f0", mutedForeground: "#94a3b8",
    primary: "#38bdf8", primaryForeground: "#082f49", ring: "#38bdf8",
    accent: "#0c4a6e", accentForeground: "#7dd3fc",
    secondary: "#16233a", muted: "#16233a",
    border: "#1e3a5f", borderStrong: "#2c4a73", input: "#1e3a5f",
    brandNavy: "#0c4a6e", brandBlue: "#38bdf8", brandSky: "#7dd3fc",
  },
}

/** Tailwind CSS — Emerald */
const EMERALD: ThemePalette = {
  id: "emerald",
  name: "Emerald",
  source: "Tailwind CSS",
  description: "Fresh emerald primary over calm green-tinted neutrals.",
  light: {
    pageBg: "#f2f7f4", background: "#ffffff", card: "#ffffff",
    sidebar: "#ffffff", popover: "#ffffff",
    foreground: "#1c2622", mutedForeground: "#5f6f66",
    primary: "#059669", primaryForeground: "#ffffff", ring: "#059669",
    accent: "#ecfdf5", accentForeground: "#047857",
    secondary: "#f3f6f4", muted: "#f3f6f4",
    border: "#d8e4dc", borderStrong: "#b9c9c0", input: "#d8e4dc",
    brandNavy: "#064e3b", brandBlue: "#059669", brandSky: "#10b981",
  },
  dark: {
    pageBg: "#0b1410", background: "#101a15", card: "#16241e",
    sidebar: "#131f1a", popover: "#16241e",
    foreground: "#e6efe9", mutedForeground: "#8fa79a",
    primary: "#34d399", primaryForeground: "#062e1e", ring: "#34d399",
    accent: "#064e3b", accentForeground: "#6ee7b7",
    secondary: "#16241e", muted: "#16241e",
    border: "#1f3a2d", borderStrong: "#2b4d3c", input: "#1f3a2d",
    brandNavy: "#064e3b", brandBlue: "#10b981", brandSky: "#34d399",
  },
}

/** Nord Theme — Arctic, north-bluish */
const NORD: ThemePalette = {
  id: "nord",
  name: "Nord",
  source: "Nord Theme",
  description: "Arctic blues. Calm, muted, and easy on the eyes.",
  light: {
    pageBg: "#eceff4", background: "#f7f9fb", card: "#ffffff",
    sidebar: "#f7f9fb", popover: "#ffffff",
    foreground: "#2e3440", mutedForeground: "#6b7484",
    primary: "#5e81ac", primaryForeground: "#ffffff", ring: "#5e81ac",
    accent: "#e5e9f0", accentForeground: "#3b4252",
    secondary: "#e5e9f0", muted: "#e5e9f0",
    border: "#d8dee9", borderStrong: "#c1c9d6", input: "#d8dee9",
    brandNavy: "#3b4252", brandBlue: "#5e81ac", brandSky: "#88c0d0",
  },
  dark: {
    pageBg: "#232933", background: "#2e3440", card: "#3b4252",
    sidebar: "#343b47", popover: "#3b4252",
    foreground: "#eceff4", mutedForeground: "#9aa4b3",
    primary: "#88c0d0", primaryForeground: "#2e3440", ring: "#88c0d0",
    accent: "#434c5e", accentForeground: "#e5e9f0",
    secondary: "#3b4252", muted: "#3b4252",
    border: "#4c566a", borderStrong: "#5d677c", input: "#4c566a",
    brandNavy: "#3b4252", brandBlue: "#81a1c1", brandSky: "#88c0d0",
  },
}

/** Dracula Theme */
const DRACULA: ThemePalette = {
  id: "dracula",
  name: "Dracula",
  source: "Dracula Theme",
  description: "Distinctive purple-on-dark with soft pastel accents.",
  light: {
    pageBg: "#f6f7fb", background: "#ffffff", card: "#ffffff",
    sidebar: "#f6f7fb", popover: "#ffffff",
    foreground: "#282a36", mutedForeground: "#6a6f84",
    primary: "#7b5cd6", primaryForeground: "#ffffff", ring: "#7b5cd6",
    accent: "#f0ebfc", accentForeground: "#4b3a8f",
    secondary: "#f1f2f8", muted: "#f1f2f8",
    border: "#e2e4f0", borderStrong: "#c7cbe0", input: "#e2e4f0",
    brandNavy: "#44475a", brandBlue: "#7b5cd6", brandSky: "#8be9fd",
  },
  dark: {
    pageBg: "#1f2029", background: "#282a36", card: "#343746",
    sidebar: "#2c2e3a", popover: "#343746",
    foreground: "#f8f8f2", mutedForeground: "#a3a6bd",
    primary: "#bd93f9", primaryForeground: "#282a36", ring: "#bd93f9",
    accent: "#44475a", accentForeground: "#d9c9fa",
    secondary: "#343746", muted: "#343746",
    border: "#44475a", borderStrong: "#565b71", input: "#44475a",
    brandNavy: "#44475a", brandBlue: "#6272a4", brandSky: "#8be9fd",
  },
}

/** Solarized */
const SOLARIZED: ThemePalette = {
  id: "solarized",
  name: "Solarized",
  source: "Solarized",
  description: "Warm paper light theme with precise, muted accents.",
  light: {
    pageBg: "#eee8d5", background: "#fdf6e3", card: "#fdf6e3",
    sidebar: "#f8f3e0", popover: "#fdf6e3",
    foreground: "#586e75", mutedForeground: "#93a1a1",
    primary: "#268bd2", primaryForeground: "#fdf6e3", ring: "#268bd2",
    accent: "#eee8d5", accentForeground: "#073642",
    secondary: "#eee8d5", muted: "#eee8d5",
    border: "#d5ceb8", borderStrong: "#b8b293", input: "#d5ceb8",
    brandNavy: "#073642", brandBlue: "#268bd2", brandSky: "#2aa198",
  },
  dark: {
    pageBg: "#00212b", background: "#002b36", card: "#073642",
    sidebar: "#04303c", popover: "#073642",
    foreground: "#93a1a1", mutedForeground: "#657b83",
    primary: "#268bd2", primaryForeground: "#002b36", ring: "#268bd2",
    accent: "#073642", accentForeground: "#839496",
    secondary: "#073642", muted: "#073642",
    border: "#124a57", borderStrong: "#1b5b69", input: "#124a57",
    brandNavy: "#073642", brandBlue: "#268bd2", brandSky: "#2aa198",
  },
}

/** Catppuccin — Latte (light) / Mocha (dark) */
const CATPPUCCIN: ThemePalette = {
  id: "catppuccin",
  name: "Catppuccin",
  source: "Catppuccin",
  description: "Pastel Latte by day, cozy Mocha at night.",
  light: {
    pageBg: "#e6e9ef", background: "#eff1f5", card: "#ffffff",
    sidebar: "#eff1f5", popover: "#ffffff",
    foreground: "#4c4f69", mutedForeground: "#8c8fa1",
    primary: "#1e66f5", primaryForeground: "#ffffff", ring: "#1e66f5",
    accent: "#dce0f8", accentForeground: "#1e66f5",
    secondary: "#e6e9ef", muted: "#e6e9ef",
    border: "#ccd0da", borderStrong: "#b8bcc8", input: "#ccd0da",
    brandNavy: "#1e1e2e", brandBlue: "#1e66f5", brandSky: "#04a5e5",
  },
  dark: {
    pageBg: "#11111b", background: "#1e1e2e", card: "#313244",
    sidebar: "#262639", popover: "#313244",
    foreground: "#cdd6f4", mutedForeground: "#a6adc8",
    primary: "#89b4fa", primaryForeground: "#1e1e2e", ring: "#89b4fa",
    accent: "#313244", accentForeground: "#b4befe",
    secondary: "#313244", muted: "#313244",
    border: "#45475a", borderStrong: "#585b70", input: "#45475a",
    brandNavy: "#1e1e2e", brandBlue: "#89b4fa", brandSky: "#89dceb",
  },
}

/** Tailwind CSS — Amber */
const AMBER: ThemePalette = {
  id: "amber",
  name: "Amber",
  source: "Tailwind CSS",
  description: "Warm terracotta primary over soft cream neutrals.",
  light: {
    pageBg: "#faf6f0", background: "#fffdfa", card: "#ffffff",
    sidebar: "#fffdfa", popover: "#ffffff",
    foreground: "#292118", mutedForeground: "#78716c",
    primary: "#c2410c", primaryForeground: "#ffffff", ring: "#c2410c",
    accent: "#ffedd5", accentForeground: "#9a3412",
    secondary: "#f5f0e8", muted: "#f5f0e8",
    border: "#e7dfd2", borderStrong: "#d6c9b4", input: "#e7dfd2",
    brandNavy: "#7c2d12", brandBlue: "#c2410c", brandSky: "#f97316",
  },
  dark: {
    pageBg: "#1c1410", background: "#241a13", card: "#2e2119",
    sidebar: "#281c15", popover: "#2e2119",
    foreground: "#f3ece2", mutedForeground: "#b3a495",
    primary: "#fb923c", primaryForeground: "#2b1608", ring: "#fb923c",
    accent: "#431407", accentForeground: "#fdba74",
    secondary: "#2e2119", muted: "#2e2119",
    border: "#42332a", borderStrong: "#584434", input: "#42332a",
    brandNavy: "#7c2d12", brandBlue: "#ea580c", brandSky: "#fb923c",
  },
}

/** Tailwind CSS — Rose */
const ROSE: ThemePalette = {
  id: "rose",
  name: "Rose",
  source: "Tailwind CSS",
  description: "Deep rose primary over cool, muted pink-grey neutrals.",
  light: {
    pageBg: "#fbf5f6", background: "#fffbfc", card: "#ffffff",
    sidebar: "#fffbfc", popover: "#ffffff",
    foreground: "#271520", mutedForeground: "#79697a",
    primary: "#be123c", primaryForeground: "#ffffff", ring: "#be123c",
    accent: "#ffe4e6", accentForeground: "#9f123c",
    secondary: "#f6eef1", muted: "#f6eef1",
    border: "#ecdde3", borderStrong: "#d9c1cb", input: "#ecdde3",
    brandNavy: "#881337", brandBlue: "#be123c", brandSky: "#fb7185",
  },
  dark: {
    pageBg: "#1c1216", background: "#24151b", card: "#301c24",
    sidebar: "#2a181f", popover: "#301c24",
    foreground: "#f5e9ed", mutedForeground: "#b39aa4",
    primary: "#fb7185", primaryForeground: "#2c0e14", ring: "#fb7185",
    accent: "#4c0519", accentForeground: "#fda4af",
    secondary: "#301c24", muted: "#301c24",
    border: "#452832", borderStrong: "#5c3541", input: "#452832",
    brandNavy: "#881337", brandBlue: "#e11d48", brandSky: "#fb7185",
  },
}

/** Tailwind CSS — Slate Mono (monochrome zinc neutrals + a single electric-blue pop) */
const SLATE_MONO: ThemePalette = {
  id: "slate-mono",
  name: "Slate Mono",
  source: "Tailwind CSS",
  description: "Pure monochrome zinc with a single electric-blue accent.",
  light: {
    pageBg: "#fafafa", background: "#ffffff", card: "#ffffff",
    sidebar: "#fafafa", popover: "#ffffff",
    foreground: "#18181b", mutedForeground: "#71717a",
    primary: "#2563eb", primaryForeground: "#ffffff", ring: "#2563eb",
    accent: "#f4f4f5", accentForeground: "#18181b",
    secondary: "#f4f4f5", muted: "#f4f4f5",
    border: "#e4e4e7", borderStrong: "#d4d4d8", input: "#e4e4e7",
    brandNavy: "#27272a", brandBlue: "#2563eb", brandSky: "#60a5fa",
  },
  dark: {
    pageBg: "#09090b", background: "#101012", card: "#18181b",
    sidebar: "#131315", popover: "#18181b",
    foreground: "#fafafa", mutedForeground: "#a1a1aa",
    primary: "#60a5fa", primaryForeground: "#0a1120", ring: "#60a5fa",
    accent: "#27272a", accentForeground: "#e4e4e7",
    secondary: "#1f1f22", muted: "#1f1f22",
    border: "#27272a", borderStrong: "#3f3f46", input: "#27272a",
    brandNavy: "#3f3f46", brandBlue: "#3b82f6", brandSky: "#60a5fa",
  },
}

/** Tailwind CSS — Forest */
const FOREST: ThemePalette = {
  id: "forest",
  name: "Forest",
  source: "Tailwind CSS",
  description: "Deep forest green primary over warm bone neutrals.",
  light: {
    pageBg: "#f5f6f1", background: "#fbfbf8", card: "#ffffff",
    sidebar: "#fbfbf8", popover: "#ffffff",
    foreground: "#1c2318", mutedForeground: "#697165",
    primary: "#166534", primaryForeground: "#ffffff", ring: "#166534",
    accent: "#dcfce7", accentForeground: "#166534",
    secondary: "#eef0e9", muted: "#eef0e9",
    border: "#dde2d5", borderStrong: "#c3cbb7", input: "#dde2d5",
    brandNavy: "#14532d", brandBlue: "#166534", brandSky: "#4ade80",
  },
  dark: {
    pageBg: "#0f1710", background: "#141d15", card: "#1a261b",
    sidebar: "#17211a", popover: "#1a261b",
    foreground: "#e9efe6", mutedForeground: "#9aab93",
    primary: "#4ade80", primaryForeground: "#052e13", ring: "#4ade80",
    accent: "#14532d", accentForeground: "#86efac",
    secondary: "#1a261b", muted: "#1a261b",
    border: "#25352a", borderStrong: "#33473a", input: "#25352a",
    brandNavy: "#14532d", brandBlue: "#22c55e", brandSky: "#4ade80",
  },
}

/** All selectable palettes (default first). */
export const PALETTES: ThemePalette[] = [
  DEFAULT_PALETTE,
  INDIGO,
  VIOLET,
  OCEAN,
  EMERALD,
  NORD,
  DRACULA,
  SOLARIZED,
  CATPPUCCIN,
  AMBER,
  ROSE,
  SLATE_MONO,
  FOREST,
]

export function getPalette(id: string | null | undefined): ThemePalette | undefined {
  if (!id) return undefined
  return PALETTES.find(p => p.id === id)
}

/* ── CSS generation ───────────────────────────────────────────────────── */

function buildVarDecls(c: PaletteColors): string {
  const entries: Array<[string, string]> = [
    ["--page-bg", c.pageBg],
    ["--background", c.background],
    ["--card", c.card],
    ["--sidebar", c.sidebar],
    ["--popover", c.popover],
    ["--page-fg", c.foreground],
    ["--foreground", c.foreground],
    ["--card-foreground", c.foreground],
    ["--popover-foreground", c.foreground],
    ["--sidebar-foreground", c.foreground],
    ["--secondary-fg", c.foreground],
    ["--muted-foreground", c.mutedForeground],
    ["--primary", c.primary],
    ["--primary-foreground", c.primaryForeground],
    ["--ring", c.ring],
    ["--accent", c.accent],
    ["--accent-foreground", c.accentForeground],
    ["--secondary", c.secondary],
    ["--secondary-foreground", c.foreground],
    ["--muted", c.muted],
    ["--border", c.border],
    ["--border-strong", c.borderStrong ?? c.border],
    ["--input", c.input ?? c.border],
    ["--sidebar-primary", c.primary],
    ["--sidebar-primary-foreground", c.primaryForeground],
    ["--sidebar-accent", c.accent],
    ["--sidebar-accent-foreground", c.accentForeground],
    ["--sidebar-border", c.border],
    ["--sidebar-ring", c.ring],
    ["--brand-navy", c.brandNavy],
    ["--brand-blue", c.brandBlue],
    ["--brand-sky", c.brandSky],
  ]
  return entries.map(([k, v]) => `${k}:${v}`).join(";")
}

/** Build the injected <style> content for a palette (both modes). */
export function buildPaletteCss(palette: ThemePalette): string {
  return `:root{${buildVarDecls(palette.light)}}:root.dark{${buildVarDecls(palette.dark)}}`
}

/* ── Runtime apply (client only) ──────────────────────────────────────── */

export function applyPalette(id: string | null | undefined): void {
  if (typeof document === "undefined") return
  document.getElementById(STYLE_ID)?.remove()
  if (!id || id === DEFAULT_PALETTE_ID) return
  const palette = getPalette(id)
  if (!palette) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = buildPaletteCss(palette)
  document.head.appendChild(style)
}

export function getStoredPaletteId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredPaletteId(id: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (id && id !== DEFAULT_PALETTE_ID) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable (private mode) — ignore
  }
}

