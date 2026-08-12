"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import {
  Check,
  Layers,
  Palette,
  RotateCcw,
  Settings2,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import {
  applyPalette,
  DEFAULT_PALETTE_ID,
  getStoredPaletteId,
  PALETTES,
  setStoredPaletteId,
  type PaletteColors,
  type ThemePalette,
} from "@/lib/theme/palettes"
import {
  applyPattern,
  DEFAULT_PATTERN_ID,
  getStoredPatternId,
  PATTERNS,
  setStoredPatternId,
} from "@/lib/theme/patterns"

/* ── Scoped preview helpers ──────────────────────────────────────────────
   A preview panel renders real components inside a wrapper that carries a
   palette's CSS variables as inline styles. Utilities like `bg-primary`
   resolve through `@theme inline` → var(--primary), so the scoped vars
   re-skin the preview without touching the app's real theme. */

function paletteVarsForMode(palette: ThemePalette | null, mode: "light" | "dark") {
  if (!palette) return undefined
  return {
    "--page-bg": palette[mode].pageBg,
    "--background": palette[mode].background,
    "--card": palette[mode].card,
    "--sidebar": palette[mode].sidebar,
    "--popover": palette[mode].popover,
    "--foreground": palette[mode].foreground,
    "--card-foreground": palette[mode].foreground,
    "--popover-foreground": palette[mode].foreground,
    "--sidebar-foreground": palette[mode].foreground,
    "--secondary-fg": palette[mode].foreground,
    "--muted-foreground": palette[mode].mutedForeground,
    "--primary": palette[mode].primary,
    "--primary-foreground": palette[mode].primaryForeground,
    "--ring": palette[mode].ring,
    "--accent": palette[mode].accent,
    "--accent-foreground": palette[mode].accentForeground,
    "--secondary": palette[mode].secondary,
    "--secondary-foreground": palette[mode].foreground,
    "--muted": palette[mode].muted,
    "--border": palette[mode].border,
    "--border-strong": palette[mode].borderStrong ?? palette[mode].border,
    "--input": palette[mode].input ?? palette[mode].border,
    "--sidebar-primary": palette[mode].primary,
    "--sidebar-primary-foreground": palette[mode].primaryForeground,
    "--sidebar-accent": palette[mode].accent,
    "--sidebar-accent-foreground": palette[mode].accentForeground,
    "--sidebar-border": palette[mode].border,
    "--sidebar-ring": palette[mode].ring,
    "--brand-navy": palette[mode].brandNavy,
    "--brand-blue": palette[mode].brandBlue,
    "--brand-sky": palette[mode].brandSky,
  } as React.CSSProperties
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1" title={label}>
      <span
        className="size-6 rounded-md border border-black/10 shadow-sm transition-transform group-hover:scale-110"
        style={{ background: color }}
      />
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  )
}

function paletteSwatches(p: PaletteColors) {
  return [
    { color: p.primary, label: "Primary" },
    { color: p.accent, label: "Accent" },
    { color: p.background, label: "Surface" },
    { color: p.foreground, label: "Text" },
    { color: p.border, label: "Border" },
  ]
}

/* ── Preview components ──────────────────────────────────────────────────
   A miniature app shell + sample components that show a palette's real
   look. Wrapped in the scoped palette vars. */

function PreviewShell({ palette, mode }: { palette: ThemePalette | null; mode: "light" | "dark" }) {
  const vars = paletteVarsForMode(palette, mode)

  return (
    <div
      style={vars}
      className="overflow-hidden rounded-xl border border-border bg-background text-foreground"
    >
      {/* Mini sidebar */}
      <div className="flex">
        <div className="w-32 shrink-0 border-r border-sidebar-border bg-sidebar p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
            <span className="flex size-4 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-caption">P</span>
            <span className="text-item font-semibold text-sidebar-foreground leading-none">PipelineIQ</span>
          </div>
          {["Profiles", "Discovery", "Leads"].map((item, i) => (
            <div
              key={item}
              className={cn(
                "rounded-md px-2 py-1 text-caption leading-none",
                i === 0
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Mini content */}
        <div className="flex-1 min-w-0 p-3 space-y-3">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <p className="text-item font-semibold text-foreground">Discovery</p>
            <div className="flex items-center gap-1.5">
              <span className="size-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-caption font-bold">S</span>
            </div>
          </div>

          {/* Stat card */}
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-caption text-muted-foreground">Relevance</p>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">86</p>
            <Progress value={86} className="mt-1.5" />
          </div>

          {/* Job card */}
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-item font-semibold text-foreground truncate">Senior Frontend Engineer</p>
              <Badge>New</Badge>
            </div>
            <p className="text-caption text-muted-foreground">Acme Inc · Remote</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary">Remote</Badge>
              <Badge variant="outline">LinkedIn</Badge>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="h-6 px-2 text-caption">Apply</Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-caption">Dismiss</Button>
            </div>
          </div>

          {/* Input + alert */}
          <Input placeholder="Search jobs…" className="h-7 text-caption" />
          <div className="rounded-md border border-border bg-card px-2 py-1.5 text-caption text-muted-foreground">
            <span className="font-semibold text-foreground">Note:</span> matches your profile.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main tab ──────────────────────────────────────────────────────────── */

// Re-renders on both cross-tab storage events and same-tab writes.
function onStorageChange(events: string[], callback: () => void) {
  window.addEventListener("storage", callback)
  events.forEach(e => window.addEventListener(e, callback))
  return () => {
    window.removeEventListener("storage", callback)
    events.forEach(e => window.removeEventListener(e, callback))
  }
}

const PALETTE_CHANGED_EVENT = "pipelineiq:palette-changed"
const PATTERN_CHANGED_EVENT = "pipelineiq:pattern-changed"

export default function SettingsTab() {
  const { resolvedTheme } = useTheme()
  const mounted = useMounted()
  // Gate theme-dependent rendering on mount so SSR/hydration stay in sync
  // (resolvedTheme is undefined on the server).
  const mode: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light"

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [patternPreviewId, setPatternPreviewId] = useState<string | null>(null)

  // Hydration-safe snapshot of the stored palette: returns null on the
  // server, the real id on the client, and re-renders on storage events.
  const selectedId = useSyncExternalStore(
    cb => onStorageChange([PALETTE_CHANGED_EVENT], cb),
    getStoredPaletteId,
    () => null,
  )

  // Same as above for the background pattern.
  const selectedPatternId = useSyncExternalStore(
    cb => onStorageChange([PATTERN_CHANGED_EVENT], cb),
    getStoredPatternId,
    () => null,
  )

  // DEFAULT_PALETTE_ID is always in PALETTES, so these are never undefined.
  const preview =
    PALETTES.find(p => p.id === (previewId ?? selectedId ?? DEFAULT_PALETTE_ID)) ??
    PALETTES[0]

  const selectPalette = (id: string) => {
    setStoredPaletteId(id)
    applyPalette(id)
    // Same-tab writes don't fire the storage event — notify the store.
    window.dispatchEvent(new Event(PALETTE_CHANGED_EVENT))
  }

  const isDefault = (selectedId ?? DEFAULT_PALETTE_ID) === DEFAULT_PALETTE_ID

  const previewCaption = useMemo(() => {
    if (preview.id === DEFAULT_PALETTE_ID) return "Built-in look"
    if (preview.id === selectedId) return "Currently applied"
    return "Hover to preview, click to apply"
  }, [preview, selectedId])

  // DEFAULT_PATTERN_ID is always in PATTERNS, so this is never undefined.
  const previewPattern =
    PATTERNS.find(p => p.id === (patternPreviewId ?? selectedPatternId ?? DEFAULT_PATTERN_ID)) ??
    PATTERNS[0]

  const selectPattern = (id: string) => {
    setStoredPatternId(id)
    applyPattern(id)
    // Same-tab writes don't fire the storage event — notify the store.
    window.dispatchEvent(new Event(PATTERN_CHANGED_EVENT))
  }

  const isPatternDefault = (selectedPatternId ?? DEFAULT_PATTERN_ID) === DEFAULT_PATTERN_ID

  const patternPreviewCaption = useMemo(() => {
    if (previewPattern.id === DEFAULT_PATTERN_ID) return "Built-in look"
    if (previewPattern.id === selectedPatternId) return "Currently applied"
    return "Hover to preview, click to apply"
  }, [previewPattern, selectedPatternId])

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border bg-background px-6 py-4 shrink-0">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personalize colors and the app shell background. Applied instantly and saved to this browser.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectPalette(DEFAULT_PALETTE_ID)}
          disabled={isDefault}
          className="shrink-0"
        >
          <RotateCcw className="size-3.5" />
          Reset to default
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
          {/* Palette grid */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="size-4 text-primary" />
              <h2 className="text-item font-semibold text-foreground">Color palettes</h2>
              <span className="text-caption text-muted-foreground">
                from Tailwind CSS, Radix UI, Nord, Dracula, Solarized, Catppuccin
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PALETTES.map(palette => {
                const id = palette.id
                const isSelected = (selectedId ?? DEFAULT_PALETTE_ID) === id
                const isPreviewing = previewId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectPalette(id)}
                    onMouseEnter={() => setPreviewId(id)}
                    onMouseLeave={() => setPreviewId(null)}
                    className={cn(
                      "group relative flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:shadow-sm",
                      isPreviewing && !isSelected && "border-primary/50",
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}

                    <div className="flex items-center gap-2 pr-6">
                      <span className="text-item font-semibold text-foreground">{palette.name}</span>
                      <Badge variant="outline" className="h-4 px-1.5 text-caption text-muted-foreground">
                        {palette.source}
                      </Badge>
                    </div>

                    <p className="text-caption text-muted-foreground leading-snug">
                      {palette.description}
                    </p>

                    <div className="flex items-center gap-2.5 pt-0.5">
                      {paletteSwatches(palette[mode]).map(s => (
                        <Swatch key={s.label} color={s.color} label={s.label} />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Pattern grid */}
            <div className="flex items-center gap-2 mb-3 mt-8">
              <Layers className="size-4 text-primary" />
              <h2 className="text-item font-semibold text-foreground">Background patterns</h2>
              <span className="text-caption text-muted-foreground">
                textures for the app shell
              </span>
              {!isPatternDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2 text-caption"
                  onClick={() => selectPattern(DEFAULT_PATTERN_ID)}
                >
                  <RotateCcw className="size-3" />
                  Reset
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PATTERNS.map(pattern => {
                const isSelected = (selectedPatternId ?? DEFAULT_PATTERN_ID) === pattern.id
                const isPreviewing = patternPreviewId === pattern.id
                return (
                  <button
                    key={pattern.id}
                    type="button"
                    onClick={() => selectPattern(pattern.id)}
                    onMouseEnter={() => setPatternPreviewId(pattern.id)}
                    onMouseLeave={() => setPatternPreviewId(null)}
                    className={cn(
                      "group relative flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:shadow-sm",
                      isPreviewing && !isSelected && "border-primary/50",
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}

                    <div
                      className="h-16 rounded-md border border-border overflow-hidden"
                      style={{ background: pattern.css }}
                    />

                    <div className="flex items-center gap-2 pr-6">
                      <span className="text-item font-semibold text-foreground">{pattern.name}</span>
                    </div>

                    <p className="text-caption text-muted-foreground leading-snug">
                      {pattern.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Live preview */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 text-primary" />
                <h2 className="text-item font-semibold text-foreground">Preview</h2>
              </div>
              {mounted && (
                <span className="text-caption text-muted-foreground">{previewCaption}</span>
              )}
            </div>

            <div className="sticky top-0 space-y-3">
              <PreviewShell palette={preview} mode={mode} />

              {/* Pattern preview */}
              <div className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-caption font-semibold text-foreground">
                    {previewPattern.name} pattern
                  </p>
                  {mounted && (
                    <span className="text-caption text-muted-foreground">{patternPreviewCaption}</span>
                  )}
                </div>
                <div
                  className="h-32 rounded-md border border-border"
                  style={{ background: previewPattern.css }}
                />
                <p className="text-caption text-muted-foreground mt-2 leading-relaxed">
                  {previewPattern.description}
                </p>
              </div>

              {/* Swatch legend for the previewing palette */}
              <div className="rounded-lg border border-border bg-card p-3.5">
                <p className="text-caption font-semibold text-foreground mb-2">
                  {preview.name} · {mode === "dark" ? "Dark" : "Light"} tokens
                </p>
                <div className="flex items-center gap-2.5">
                  {paletteSwatches(preview[mode]).map(s => (
                    <Swatch key={s.label} color={s.color} label={s.label} />
                  ))}
                </div>
              </div>

              <p className="text-caption text-muted-foreground leading-relaxed">
                Preview panels are scoped to this screen. Hover a palette or pattern to preview
                it, then click to apply it app-wide. Your choices are stored in localStorage and
                restored on next visit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
