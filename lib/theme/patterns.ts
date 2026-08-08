/* ════════════════════════════════════════════════════════════════════════
   🎨 BACKGROUND PATTERNS — user-selectable shell textures
   ────────────────────────────────────────────────────────────────────────
   The app shell's texture lives in `--page-bg-pattern` (see
   `app/theme/patterns.css`), a complete `background` shorthand value that
   the `.bg-page-bg` utility paints on the shell, auth pages, and drawer
   side panels. Each pattern below is a different composition of the recipe
   layers defined in that file (`--pattern-dots`, `--pattern-grid`, …), so
   every option adapts to the active color palette and light/dark mode
   automatically (the recipes derive from theme tokens via color-mix()).

   Selecting one:
   1. persists the pattern id in localStorage,
   2. injects a `<style id="pipelineiq-pattern-style">` block that overrides
      `--page-bg-pattern` on `:root`. Unlayered and appended last in <head>,
      it wins over the default in patterns.css. Clearing it (or selecting
      the default "Dots" pattern) restores the built-in texture.

   ▶ To add a pattern: compose the recipe vars from patterns.css (or add a
     new recipe there first) into a `css` background value, then append it
     to the PATTERNS list.
   ════════════════════════════════════════════════════════════════════════ */

export interface ThemePattern {
  id: string
  name: string
  description: string
  /** Complete `background` shorthand value for `--page-bg-pattern`. */
  css: string
}

export const DEFAULT_PATTERN_ID = "dots"

export const STORAGE_KEY = "pipelineiq.theme.pattern"

export const STYLE_ID = "pipelineiq-pattern-style"

/** The app's built-in look — selecting this clears any pattern override. */
const DEFAULT_PATTERN: ThemePattern = {
  id: DEFAULT_PATTERN_ID,
  name: "Dots",
  description: "The default PipelineIQ texture — a quiet dot grid with a soft brand glow.",
  css: "var(--pattern-dots), var(--pattern-fade-to-page), var(--pattern-glow-blue), var(--pattern-glow-navy), var(--page-bg)",
}

/** Blueprint grid lines, softened toward the bottom of the page. */
const GRID: ThemePattern = {
  id: "grid",
  name: "Blueprint",
  description: "Fine blueprint grid lines that fade toward the bottom of the page.",
  css: "var(--pattern-grid), var(--pattern-fade-to-page), var(--page-bg)",
}

/** Low-contrast 45° hairline stripes. */
const STRIPES: ThemePattern = {
  id: "stripes",
  name: "Stripes",
  description: "Low-contrast 45° hairline stripes — subtle but energetic.",
  css: "var(--pattern-stripes), var(--pattern-fade-to-page), var(--page-bg)",
}

/** Outlined business icons — briefcase, building, user, mail, docs, chart. */
const BUSINESS: ThemePattern = {
  id: "business",
  name: "Business",
  description: "Clean outlined business icons — briefcases, buildings, documents and more.",
  css: "var(--pattern-icon-business), var(--page-bg)",
}

/** Outlined food icons — coffee, donut, burger, pizza, fruit. */
const FOOD: ThemePattern = {
  id: "food",
  name: "Food",
  description: "Neat outlined food icons — coffee, pizza, burgers and fruit.",
  css: "var(--pattern-icon-food), var(--page-bg)",
}

/** Outlined board & chart icons — presentation boards, pie/line/bar charts. */
const CHARTS: ThemePattern = {
  id: "charts",
  name: "Board & Charts",
  description: "Outlined presentation boards and analytics charts — pie, line, bar and gauges.",
  css: "var(--pattern-icon-charts), var(--page-bg)",
}

/** All selectable patterns (default first). */
export const PATTERNS: ThemePattern[] = [
  DEFAULT_PATTERN,
  GRID,
  STRIPES,
  BUSINESS,
  FOOD,
  CHARTS,
]

export function getPattern(id: string | null | undefined): ThemePattern | undefined {
  if (!id) return undefined
  return PATTERNS.find(p => p.id === id)
}

/* ── CSS generation ───────────────────────────────────────────────────── */

/** Build the injected <style> content for a pattern. */
export function buildPatternCss(pattern: ThemePattern): string {
  return `:root{--page-bg-pattern:${pattern.css}}`
}

/* ── Runtime apply (client only) ──────────────────────────────────────── */

export function applyPattern(id: string | null | undefined): void {
  if (typeof document === "undefined") return
  document.getElementById(STYLE_ID)?.remove()
  if (!id || id === DEFAULT_PATTERN_ID) return
  const pattern = getPattern(id)
  if (!pattern) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = buildPatternCss(pattern)
  document.head.appendChild(style)
}

export function getStoredPatternId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredPatternId(id: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (id && id !== DEFAULT_PATTERN_ID) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable (private mode) — ignore
  }
}
