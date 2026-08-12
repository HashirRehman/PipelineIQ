import {
  DEFAULT_PALETTE_ID,
  PALETTES,
  buildPaletteCss,
  STORAGE_KEY as PALETTE_STORAGE_KEY,
  STYLE_ID as PALETTE_STYLE_ID,
} from "@/lib/theme/palettes"
import {
  DEFAULT_PATTERN_ID,
  PATTERNS,
  STORAGE_KEY as PATTERN_STORAGE_KEY,
  STYLE_ID as PATTERN_STYLE_ID,
} from "@/lib/theme/patterns"

// Precompute, at build time, the CSS for every non-default palette and
// pattern. The bootstrap script below looks up the stored ids and injects
// the matching styles synchronously, before the browser paints — the same
// mechanism next-themes uses for dark/light mode (no flash of the default
// theme on refresh). The runtime appliers (PaletteApplier / PatternApplier)
// keep things in sync afterwards and across tabs.
const PALETTE_CSS: Record<string, string> = {}
for (const palette of PALETTES) {
  if (palette.id !== DEFAULT_PALETTE_ID) PALETTE_CSS[palette.id] = buildPaletteCss(palette)
}

const PATTERN_CSS: Record<string, string> = {}
for (const pattern of PATTERNS) {
  if (pattern.id !== DEFAULT_PATTERN_ID) PATTERN_CSS[pattern.id] = pattern.css
}

// Reads the stored theme choices and injects the matching <style> blocks
// into <head> before first paint. Idempotent — safe if re-run by React.
const SCRIPT = `(function(){try{var p=${JSON.stringify(PALETTE_CSS)};var g=${JSON.stringify(PATTERN_CSS)};var pid=localStorage.getItem("${PALETTE_STORAGE_KEY}");if(pid&&p[pid]){var e=document.getElementById("${PALETTE_STYLE_ID}");if(e)e.remove();var s=document.createElement("style");s.id="${PALETTE_STYLE_ID}";s.textContent=p[pid];document.head.appendChild(s)}var pat=localStorage.getItem("${PATTERN_STORAGE_KEY}");if(pat&&g[pat]){var e2=document.getElementById("${PATTERN_STYLE_ID}");if(e2)e2.remove();var t=document.createElement("style");t.id="${PATTERN_STYLE_ID}";t.textContent=":root{--page-bg-pattern:"+g[pat]+"}";document.head.appendChild(t)}window.__themeBootstrapped=true}catch(err){}})()`

/**
 * Emits a synchronous <script> as the first child of <body>. It runs during
 * initial HTML parsing — before any visible content is painted — so a saved
 * palette/pattern is applied before the user sees anything.
 *
 * The `nonce` (from the proxy's per-request CSP nonce) lets the strict
 * Content-Security-Policy trust this inline script without 'unsafe-inline'.
 */
export function ThemeBootstrapScript({ nonce }: { nonce?: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
