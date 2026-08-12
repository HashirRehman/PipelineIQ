"use client"

import { useMemo, useState, useEffect, useSyncExternalStore } from "react"
import {
  Check,
  Layers,
  Palette,
  RotateCcw,
  Settings2,
  User,
  Lock,
  Loader2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { apiRequest, withOrgId } from "@/lib/api/client"
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

function PreviewShell({
  palette,
  mode,
}: {
  palette: ThemePalette
  mode: "light" | "dark"
}) {
  const vars = paletteVarsForMode(palette, mode)
  return (
    <div
      style={vars}
      className="rounded-lg border border-border bg-card p-4 text-foreground shadow-sm transition-colors"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-full bg-primary" />
          <span className="text-item font-semibold">Dashboard preview</span>
        </div>
        <Badge variant="outline" className="h-5 text-caption">
          {palette.name}
        </Badge>
      </div>

      <div className="grid gap-2 mb-3 grid-cols-2">
        <div className="rounded-md border border-border bg-background p-2.5">
          <p className="text-caption text-muted-foreground">Active leads</p>

          <p className="text-lg font-bold text-foreground">128</p>
        </div>

        <div className="rounded-md border border-border bg-background p-2.5">
          <p className="text-caption text-muted-foreground">Conversion rate</p>

          <p className="text-lg font-bold text-primary">34.2%</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">

        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>Weekly target progress</span>
          <span>78%</span>
        </div>
        <Progress value={78} className="h-1.5" />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" className="h-7 text-caption font-semibold">
          Primary action
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-caption">
          Secondary
        </Button>
      </div>
    </div>
  )
}

const PALETTE_CHANGED_EVENT = "app-palette-changed"
const PATTERN_CHANGED_EVENT = "app-pattern-changed"

function subscribePalette(callback: () => void) {
  window.addEventListener(PALETTE_CHANGED_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(PALETTE_CHANGED_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function subscribePattern(callback: () => void) {
  window.addEventListener(PATTERN_CHANGED_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(PATTERN_CHANGED_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

export default function SettingsTab() {
  const mounted = useMounted()
  const { resolvedTheme } = useTheme()
  const mode = (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "appearance">("profile")

  // Current user state
  const [userId, setUserId] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [name, setName] = useState<string>("")
  const [userRole, setUserRole] = useState<string>("")

  // Profile Form state
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState("")
  const [profileError, setProfileError] = useState("")

  // Password Form state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [passwordError, setPasswordError] = useState("")

  // Theme states
  const selectedId = useSyncExternalStore(
    subscribePalette,
    getStoredPaletteId,
    getStoredPaletteId,
  )

  const selectedPatternId = useSyncExternalStore(
    subscribePattern,
    getStoredPatternId,
    getStoredPatternId,
  )

  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          setEmail(user.email ?? "")
          setName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")

          // Direct DB query via Supabase client to fetch assigned role & name
          const { data: dbUser } = await supabase
            .from("users")
            .select("full_name, roles(name)")
            .eq("id", user.id)
            .maybeSingle()

          if (dbUser) {
            if (dbUser.full_name) setName(dbUser.full_name)
            const rName = (dbUser as unknown as { roles?: { name: string } | { name: string }[] }).roles
            const roleName = Array.isArray(rName) ? rName[0]?.name : rName?.name
            if (roleName) {
              setUserRole(roleName)
            }
          }
        }

        // Fetch DB user record for role & details with org scoping
        const res = await fetch(withOrgId("/api/users"))
        if (res.ok) {
          const data = await res.json()
          const current = data?.currentUser || (data?.users && user ? data.users.find((u: { id: string }) => u.id === user.id) : null)
          if (current) {
            const rawRole = (current.role || "").toLowerCase()
            const formattedRole =
              rawRole === "bd" ? "BD Manager" :
              rawRole === "admin" ? "Admin" :
              rawRole === "lead" ? "Business Developer" :
              current.role
            setUserRole(formattedRole)
            if (current.name) setName(current.name)
          }
        }
      } catch (err) {
        console.error("Failed to load user info:", err)
      }
    }
    loadUser()
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setProfileError("Full name cannot be empty.")
      return
    }
    setSavingProfile(true)
    setProfileError("")
    setProfileSuccess("")

    try {
      const supabase = createClient()
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
      })
      if (authErr) throw authErr

      if (userId) {
        await apiRequest("/api/users", "PATCH", { userId, name: name.trim() })
      }

      setProfileSuccess("Your name has been updated successfully!")
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile name.")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccess("")
    setPasswordError("")
    setPasswordSuccess("")

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    setSavingPassword(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setPasswordSuccess("Your password has been changed successfully!")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.")
    } finally {
      setSavingPassword(false)
    }
  }

  const activePalette = useMemo(() => {
    return (
      PALETTES.find(p => p.id === (selectedId ?? DEFAULT_PALETTE_ID)) ??
      PALETTES[0]
    )
  }, [selectedId])

  const preview = useMemo(() => {
    if (!previewId) return activePalette
    return PALETTES.find(p => p.id === previewId) ?? activePalette
  }, [previewId, activePalette])

  const isDefault = (selectedId ?? DEFAULT_PALETTE_ID) === DEFAULT_PALETTE_ID

  const previewCaption = useMemo(() => {
    if (preview.id === DEFAULT_PALETTE_ID) return "Built-in look"
    if (preview.id === selectedId) return "Currently applied"
    return "Hover preview — click to apply"
  }, [preview, selectedId])

  const activePattern = useMemo(() => {
    return (
      PATTERNS.find(p => p.id === (selectedPatternId ?? DEFAULT_PATTERN_ID)) ??
      PATTERNS[0]
    )
  }, [selectedPatternId])

  const previewPattern = activePattern
  const isPatternDefault = (selectedPatternId ?? DEFAULT_PATTERN_ID) === DEFAULT_PATTERN_ID

  const patternPreviewCaption = useMemo(() => {
    if (previewPattern.id === DEFAULT_PATTERN_ID) return "Built-in look"
    if (previewPattern.id === selectedPatternId) return "Currently applied"
    return "Hover preview — click to apply"
  }, [previewPattern, selectedPatternId])

  function selectPalette(id: string) {
    setStoredPaletteId(id)
    applyPalette(id)
    window.dispatchEvent(new Event(PALETTE_CHANGED_EVENT))
  }

  function selectPattern(id: string) {
    setStoredPatternId(id)
    applyPattern(id)
    window.dispatchEvent(new Event(PATTERN_CHANGED_EVENT))
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 border-b border-border bg-card px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">User Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your personal profile, security preferences, and dashboard appearance.
            </p>
          </div>

          {activeTab === "appearance" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectPalette(DEFAULT_PALETTE_ID)}
              disabled={isDefault}
              className="shrink-0"
            >
              <RotateCcw className="size-3.5" />
              Reset theme
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "profile"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <User className="size-3.5" />
            Profile & Account
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "security"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Lock className="size-3.5" />
            Security & Password
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "appearance"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Palette className="size-3.5" />
            Appearance & Theme
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* TAB 1: PROFILE & ACCOUNT */}
        {activeTab === "profile" && (
          <div className="max-w-2xl space-y-6">
            <form onSubmit={handleUpdateProfile} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <User className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Personal Information</h2>
              </div>

              {profileSuccess && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="max-w-md h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <Input
                  value={email}
                  readOnly
                  disabled
                  className="max-w-md h-9 text-sm bg-muted/50 cursor-not-allowed opacity-70"
                />
                <p className="text-caption text-muted-foreground">
                  Email address is linked to your organization account and cannot be changed directly.
                </p>
              </div>

              {userRole && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-foreground block">Assigned Role</label>
                  <Badge variant="outline" className="capitalize text-xs px-2.5 py-0.5">
                    {userRole}
                  </Badge>
                </div>
              )}

              <div className="pt-3 border-t border-border flex justify-end">
                <Button type="submit" disabled={savingProfile || !name.trim()} className="h-9 px-5 text-xs font-semibold">
                  {savingProfile && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  Save Profile Name
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: SECURITY & PASSWORD */}
        {activeTab === "security" && (
          <div className="max-w-2xl space-y-6">
            <form onSubmit={handleUpdatePassword} className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <KeyRound className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Change Password</h2>
              </div>

              {passwordSuccess && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">New Password</label>
                <div className="relative max-w-md">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 8 characters)"
                    className="h-9 text-sm pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="max-w-md h-9 text-sm"
                />
              </div>

              <p className="text-caption text-muted-foreground leading-relaxed">
                Ensure your password is at least 8 characters long and includes a combination of letters, numbers, and symbols for high security.
              </p>

              <div className="pt-3 border-t border-border flex justify-end">
                <Button type="submit" disabled={savingPassword || !newPassword || !confirmPassword} className="h-9 px-5 text-xs font-semibold">
                  {savingPassword && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: APPEARANCE & THEME */}
        {activeTab === "appearance" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
            {/* Palette grid */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="size-4 text-primary" />
                <h2 className="text-item font-semibold text-foreground">Color palettes</h2>
                <span className="text-caption text-muted-foreground">
                  — Tailwind, Radix UI, Nord, Dracula, Solarized, Catppuccin
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
                  — textures for the app shell
                </span>
                {!isPatternDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectPattern(DEFAULT_PATTERN_ID)}
                    className="ml-auto h-7 px-2.5 text-caption"
                  >
                    <RotateCcw className="size-3" />
                    Reset pattern
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {PATTERNS.map(pat => {
                  const isSel = (selectedPatternId ?? DEFAULT_PATTERN_ID) === pat.id
                  return (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() => selectPattern(pat.id)}
                      className={cn(
                        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-all cursor-pointer",
                        isSel
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:shadow-sm",
                      )}
                    >
                      {isSel && (
                        <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}

                      <div className="flex items-center justify-between pr-6">
                        <span className="text-item font-semibold text-foreground">{pat.name}</span>
                      </div>

                      <div
                        className="h-20 rounded-md border border-border"
                        style={{ background: pat.css }}
                      />

                      <p className="text-caption text-muted-foreground leading-snug">
                        {pat.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Live preview side panel */}
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

                {/* Swatch legend */}
                <div className="rounded-lg border border-border bg-card p-3.5">
                  <p className="text-caption font-semibold text-foreground mb-2">
                    {preview.name} — {mode === "dark" ? "Dark" : "Light"} tokens
                  </p>
                  <div className="flex items-center gap-2.5">
                    {paletteSwatches(preview[mode]).map(s => (
                      <Swatch key={s.label} color={s.color} label={s.label} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
