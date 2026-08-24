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
  Building2,
  Globe,
} from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { apiRequest, withOrgId } from "@/lib/api/client"
import { getRolePermissionsByKey } from "@/lib/auth/roles"
import { PASSWORD_REQUIREMENTS } from "@/lib/validation/schemas"
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

// Shape-matched loading state for the Organization tab — shown while the
// domain policy fetch is in flight, instead of the form defaulting to
// "restricted, no domain" and popping to the real value once the request
// resolves (misread as "no domain is configured").
function OrganizationTabSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-border pb-4">
          <Skeleton className="size-4.5 rounded" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4 flex items-start gap-3">
            <Skeleton className="size-4 rounded-full mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-64" />
              <Skeleton className="h-3 w-80" />
              <Skeleton className="h-9 w-full max-w-md mt-2" />
            </div>
          </div>
          <div className="rounded-lg border border-border p-4 flex items-start gap-3">
            <Skeleton className="size-4 rounded-full mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-72" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-border flex justify-end">
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
      <div className="min-w-0 h-fit rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  )
}

// Tab type definition
type SettingsTab = "profile" | "security" | "appearance" | "organization"

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

interface SettingsTabProps {
  user: {
    email: string
    name?: string
    role: string | null
  }
}

export default function SettingsTab({ user: initialUser }: SettingsTabProps) {
  const mounted = useMounted()
  const { resolvedTheme } = useTheme()
  const mode = (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark"

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile")

  // Current user state — use passed-in user info for immediate role/admin check
  const [userId, setUserId] = useState<string>("")
  const [name, setName] = useState<string>(initialUser.name ?? "")
  const email = initialUser.email
  const userRole = initialUser.role
  const perms = getRolePermissionsByKey(userRole)
  const isAdmin = perms.canManageUsers

  // Profile Form state
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState("")
  const [profileError, setProfileError] = useState("")

  // Password Form state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [passwordError, setPasswordError] = useState("")

  const passwordChecks = useMemo(() => ({
    minLength: newPassword.length >= PASSWORD_REQUIREMENTS.minLength,
    hasLetterAndNumber:
      PASSWORD_REQUIREMENTS.hasLetter(newPassword) && PASSWORD_REQUIREMENTS.hasNumber(newPassword),
    hasSymbol: PASSWORD_REQUIREMENTS.hasSymbol(newPassword),
    matches: newPassword.length > 0 && newPassword === confirmPassword,
  }), [newPassword, confirmPassword])

  const passwordMeetsRequirements =
    passwordChecks.minLength && passwordChecks.hasLetterAndNumber && passwordChecks.hasSymbol

  const canSubmitPassword = passwordMeetsRequirements && passwordChecks.matches

  // Organization settings state (Admin only)
  const [orgDomainMode, setOrgDomainMode] = useState<"restricted" | "any">("restricted")
  const [orgDomainInput, setOrgDomainInput] = useState("")
  const [originalOrgDomainMode, setOriginalOrgDomainMode] = useState<"restricted" | "any">("restricted")
  const [originalOrgDomainInput, setOriginalOrgDomainInput] = useState("")
  const [savingOrgSettings, setSavingOrgSettings] = useState(false)
  const [orgSuccess, setOrgSuccess] = useState("")
  const [orgError, setOrgError] = useState("")
  // True until the org-settings fetch resolves — the domain policy defaults
  // to "restricted" with an empty domain before the real value loads, which
  // reads as "no domain is set" if rendered as-is. Gate the org fields (and
  // anything that echoes org state, like the current-policy panel) behind
  // this instead of showing that misleading default.
  const [isLoadingOrgSettings, setIsLoadingOrgSettings] = useState(true)

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
    // Use AbortController to prevent state updates if component unmounts
    // during async operations (race condition prevention)
    const ctrl = new AbortController()
    let mounted = true

    async function loadUser() {
      try {
        // Fetch current user ID via API
        const meRes = await fetch("/api/me", { signal: ctrl.signal })
        if (!mounted) return

        if (meRes.ok) {
          const { id } = await meRes.json()
          if (!mounted) return
          setUserId(id)
        } else if (meRes.status === 401) {
          console.error("Unauthorized: no active session")
        } else {
          console.error("Failed to fetch current user:", meRes.status, meRes.statusText)
        }

        // Fetch Organization settings
        try {
          const orgUrl = withOrgId("/api/organization/settings")
          const orgRes = await fetch(orgUrl, { signal: ctrl.signal })
          if (!mounted) return

          if (orgRes.ok) {
            const orgData = await orgRes.json()
            if (!mounted) return

            if (orgData?.allowedEmailDomain && typeof orgData.allowedEmailDomain === "string" && orgData.allowedEmailDomain.trim() !== "") {
              setOrgDomainMode("restricted")
              setOrgDomainInput(orgData.allowedEmailDomain)
              setOriginalOrgDomainMode("restricted")
              setOriginalOrgDomainInput(orgData.allowedEmailDomain)
            } else {
              setOrgDomainMode("any")
              setOriginalOrgDomainMode("any")
              setOriginalOrgDomainInput("")
            }
          } else {
            console.error("Failed to fetch organization settings:", orgRes.status, orgRes.statusText)
            const errorData = await orgRes.text()
            console.error("Error response:", errorData)
          }
        } catch (orgErr) {
          if (orgErr instanceof DOMException && orgErr.name === "AbortError") return
          console.error("Error fetching organization settings:", orgErr)
        } finally {
          if (mounted) setIsLoadingOrgSettings(false)
        }

      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (mounted) {
          console.error("Failed to load user info:", err)
          setIsLoadingOrgSettings(false)
        }
      }
    }

    loadUser()
    return () => {
      mounted = false
      ctrl.abort()
    }
  }, [])

  const handleUpdateOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgError("")
    setOrgSuccess("")

    if (orgDomainMode === "restricted" && !orgDomainInput.trim()) {
      setOrgError("Please enter a valid domain name (e.g. recursolabs.com).")
      return
    }

    setSavingOrgSettings(true)

    try {
      const targetDomain = orgDomainMode === "any" ? null : orgDomainInput.trim()
      const data = await apiRequest<{ success: boolean; allowedEmailDomain: string | null }>(
        "/api/organization/settings",
        "PATCH",
        { allowedEmailDomain: targetDomain }
      )

      if (data.allowedEmailDomain) {
        setOrgDomainMode("restricted")
        setOrgDomainInput(data.allowedEmailDomain)
      } else {
        setOrgDomainMode("any")
      }

      setOrgSuccess("Organization email domain settings updated successfully!")
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : "Failed to update organization settings.")
    } finally {
      setSavingOrgSettings(false)
    }
  }

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
      const res = await fetch(withOrgId("/api/me/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update profile name.")
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

    if (!passwordMeetsRequirements) {
      setPasswordError("Password does not meet all requirements.")
      return
    }

    if (!passwordChecks.matches) {
      setPasswordError("Passwords do not match.")
      return
    }

    setSavingPassword(true)

    try {
      // Step 1: Update password
      const passwordRes = await fetch(withOrgId("/api/me/password"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword, confirmPassword }),
      })

      if (!passwordRes.ok) {
        const errorData = await passwordRes.json()
        throw new Error(errorData.error || "Failed to update password.")
      }

      // Step 2: Re-authenticate to get new session tokens
      const sessionRes = await fetch(withOrgId("/api/me/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: initialUser.email,
          password: newPassword,
        }),
      })

      if (!sessionRes.ok) {
        console.error("Failed to re-authenticate after password change")
        // Password was changed successfully, re-auth is best-effort
        // User will be logged out on next page load if session expired
      }
      // Session tokens (on success) are handled by Supabase cookie middleware

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

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
  }

  // Check if org settings have changed
  const orgSettingsChanged =
    orgDomainMode !== originalOrgDomainMode ||
    orgDomainInput !== originalOrgDomainInput

  return (
    <div className="flex flex-1 min-h-0 flex-col">
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
              onClick={() => {
                selectPalette(DEFAULT_PALETTE_ID)
                selectPattern(DEFAULT_PATTERN_ID)
              }}
              disabled={isDefault && isPatternDefault}
              className="shrink-0"
            >
              <RotateCcw className="size-3.5" />
              Reset all appearance
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => handleTabChange("profile")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer",
              activeTab === "profile"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <User className="size-3.5" />
            Profile & Account
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("security")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer",
              activeTab === "security"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Lock className="size-3.5" />
            Security & Password
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("appearance")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer",
              activeTab === "appearance"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Palette className="size-3.5" />
            Appearance & Theme
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleTabChange("organization")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 cursor-pointer",
                activeTab === "organization"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Building2 className="size-3.5" />
              Organization Domain
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* TAB 4: ORGANIZATION DOMAIN SETTINGS (ADMIN ONLY) */}
        {activeTab === "organization" && isAdmin && isLoadingOrgSettings && (
          <OrganizationTabSkeleton />
        )}
        {activeTab === "organization" && isAdmin && !isLoadingOrgSettings && (
          <div
            className="grid gap-4 lg:grid-cols-[1fr_320px]"
            style={{ animation: "chart-rise 0.3s ease-out backwards" }}
          >
            <form onSubmit={handleUpdateOrgSettings} className="min-w-0 rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-border pb-4">
                <Building2 className="size-4.5 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Organization Email Domain Policy</h2>
                  <p className="text-caption text-muted-foreground mt-0.5">Control allowed email domains for member invitations across your organization.</p>
                </div>
              </div>

              {orgSuccess && (
                <div className="rounded-md border border-success-foreground/20 bg-success px-4 py-3 text-xs text-success-foreground flex items-center gap-2.5">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{orgSuccess}</span>
                </div>
              )}

              {orgError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{orgError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div
                  onClick={() => setOrgDomainMode("restricted")}
                  className={cn(
                    "rounded-lg border p-4 transition-colors duration-150 cursor-pointer flex items-start gap-3",
                    orgDomainMode === "restricted"
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background hover:border-border-strong"
                  )}
                >
                  <div className="mt-0.5">
                    <input
                      type="radio"
                      name="orgDomainMode"
                      checked={orgDomainMode === "restricted"}
                      onChange={() => setOrgDomainMode("restricted")}
                      className="size-4 text-primary cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Restrict user invitations to a specific domain</p>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        Only users with email addresses matching this domain can be invited.
                      </p>
                    </div>

                    {orgDomainMode === "restricted" && (
                      <div className="pt-2" style={{ animation: "chart-fade-in 0.2s ease-out backwards" }}>
                        <label className="text-xs font-semibold text-foreground block mb-1">Allowed Domain Name</label>
                        <div className="flex items-center gap-2 w-full max-w-md relative">
                          <span className="text-sm font-medium text-muted-foreground">@</span>
                          <Input
                            value={orgDomainInput}
                            onChange={e => setOrgDomainInput(e.target.value)}
                            placeholder="company.com"
                            disabled={!mounted}
                            className="flex-1 h-9 text-sm"
                          />
                          {!mounted && (
                            <Loader2 className="absolute right-3 size-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-meta text-muted-foreground mt-1">
                          Enter the domain without @ (example: company.com).
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setOrgDomainMode("any")}
                  className={cn(
                    "rounded-lg border p-4 transition-colors duration-150 cursor-pointer flex items-start gap-3",
                    orgDomainMode === "any"
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background hover:border-border-strong"
                  )}
                >
                  <div className="mt-0.5">
                    <input
                      type="radio"
                      name="orgDomainMode"
                      checked={orgDomainMode === "any"}
                      onChange={() => setOrgDomainMode("any")}
                      className="size-4 text-primary cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">Allow invitations from any email domain</p>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      Members with any valid email domain (Gmail, Yahoo, custom) can be invited.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button type="submit" disabled={savingOrgSettings || !orgSettingsChanged}>
                  {savingOrgSettings && <Loader2 className="size-3.5 animate-spin" />}
                  Save Organization Settings
                </Button>
              </div>
            </form>

            {/* Side panel — current policy summary */}
            <div
              className="min-w-0 h-fit rounded-xl border border-border bg-card p-5 space-y-4"
              style={{ animation: "chart-rise 0.3s ease-out backwards", animationDelay: "60ms" }}
            >
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <h3 className="text-item font-semibold text-foreground">Current policy</h3>
              </div>
              <div className="rounded-md border border-border bg-background p-3.5">
                <p className="text-caption text-muted-foreground">Invitations are currently</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {originalOrgDomainMode === "restricted"
                    ? `Restricted to @${originalOrgDomainInput || "…"}`
                    : "Open to any domain"}
                </p>
              </div>
              <p className="text-caption text-muted-foreground leading-relaxed">
                This policy applies whenever an admin invites a new member. It does not affect
                members already in the organization.
              </p>
            </div>
          </div>
        )}
        {/* TAB 1: PROFILE & ACCOUNT */}
        {activeTab === "profile" && (
          <div
            className="grid gap-4 lg:grid-cols-[1fr_320px]"
            style={{ animation: "chart-rise 0.3s ease-out backwards" }}
          >
            <form onSubmit={handleUpdateProfile} className="min-w-0 rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-border pb-4">
                <User className="size-4.5 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Personal Information</h2>
                  <p className="text-caption text-muted-foreground mt-0.5">Update your display name and view account details.</p>
                </div>
              </div>

              {profileSuccess && (
                <div className="rounded-md border border-success-foreground/20 bg-success px-4 py-3 text-xs text-success-foreground flex items-center gap-2.5">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground block">Full Name</label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Enter your full name"
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      className={`h-9 text-sm ${!isAdmin ? "bg-muted/40 cursor-not-allowed opacity-75" : ""}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground block">Email Address</label>
                    <div className="relative">
                      <Input
                        value={email}
                        readOnly
                        disabled
                        placeholder={!mounted ? "Loading..." : ""}
                        className="h-9 text-sm bg-muted/40 cursor-not-allowed opacity-75"
                      />
                      {!mounted && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-caption text-muted-foreground -mt-3">
                  {isAdmin
                    ? "Email address is managed by your organization account and cannot be modified directly."
                    : "Your name, email, and role are managed by an administrator and cannot be changed here."}
                </p>

                {userRole && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground block">Assigned Role</label>
                    <Badge variant="outline" className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary border-primary/20 rounded-md">
                      {userRole}
                    </Badge>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-border flex justify-end">
                  <Button type="submit" disabled={savingProfile || !name.trim()}>
                    {savingProfile && <Loader2 className="size-3.5 animate-spin" />}
                    Save Profile Name
                  </Button>
                </div>
              )}
            </form>

            {/* Side panel — account summary */}
            <div
              className="min-w-0 h-fit rounded-xl border border-border bg-card p-5 space-y-4"
              style={{ animation: "chart-rise 0.3s ease-out backwards", animationDelay: "60ms" }}
            >
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <h3 className="text-item font-semibold text-foreground">Account summary</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Display name</span>
                  <span className="font-medium text-foreground truncate max-w-[160px]">{name || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-foreground truncate max-w-[160px]">{email}</span>
                </div>
                {userRole && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium text-foreground capitalize">{userRole}</span>
                  </div>
                )}
              </div>
              <p className="text-caption text-muted-foreground leading-relaxed border-t border-border pt-3">
                {isAdmin
                  ? "Your role and email are managed by an administrator. Only your display name can be changed here."
                  : "Your name, role, and email are managed by an administrator."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & PASSWORD */}
        {activeTab === "security" && (
          <div
            className="grid gap-4 lg:grid-cols-[1fr_320px]"
            style={{ animation: "chart-rise 0.3s ease-out backwards" }}
          >
            <form onSubmit={handleUpdatePassword} className="min-w-0 rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-border pb-4">
                <KeyRound className="size-4.5 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
                  <p className="text-caption text-muted-foreground mt-0.5">Ensure your account uses a strong, secure password.</p>
                </div>
              </div>

              {passwordSuccess && (
                <div className="rounded-md border border-success-foreground/20 bg-success px-4 py-3 text-xs text-success-foreground flex items-center gap-2.5">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2.5">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground block">New Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground block">Confirm New Password</label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="h-9 text-sm pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && !passwordChecks.matches && (
                      <p className="text-caption text-destructive">Passwords do not match.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button type="submit" disabled={savingPassword || !canSubmitPassword}>
                  {savingPassword && <Loader2 className="size-3.5 animate-spin" />}
                  Update Password
                </Button>
              </div>
            </form>

            {/* Side panel — password guidance */}
            <div
              className="min-w-0 h-fit rounded-xl border border-border bg-card p-5 space-y-4"
              style={{ animation: "chart-rise 0.3s ease-out backwards", animationDelay: "60ms" }}
            >
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" />
                <h3 className="text-item font-semibold text-foreground">Password guidelines</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  { label: "At least 8 characters long", met: passwordChecks.minLength },
                  { label: "Mix of letters and numbers", met: passwordChecks.hasLetterAndNumber },
                  { label: "At least one symbol", met: passwordChecks.hasSymbol },
                  { label: "Not reused from another account", met: undefined },
                ].map((req) => (
                  <li
                    key={req.label}
                    className={cn(
                      "flex items-start gap-2 text-xs",
                      req.met ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0 mt-0.5",
                        req.met ? "text-status-emerald" : "text-muted-foreground/60",
                      )}
                    />
                    {req.label}
                  </li>
                ))}
              </ul>
              <p className="text-caption text-muted-foreground leading-relaxed border-t border-border pt-3">
                Changing your password signs you out of other active sessions.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: APPEARANCE & THEME */}
        {activeTab === "appearance" && mounted && (
          <div
            className="grid gap-5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]"
            style={{ animation: "chart-rise 0.3s ease-out backwards" }}
          >
            {/* Palette grid */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="size-4 text-primary" />
                <h2 className="text-item font-semibold text-foreground">Color palettes</h2>
                <span className="text-caption text-muted-foreground">
                  — Tailwind, Radix UI, Nord, Dracula, Solarized, Catppuccin
                </span>
                {mounted && !isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectPalette(DEFAULT_PALETTE_ID)}
                    className="ml-auto h-7 px-2.5 text-caption"
                  >
                    <RotateCcw className="size-3" />
                    Reset theme
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {PALETTES.map((palette, i) => {
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
                      style={{ animation: "chart-rise 0.25s ease-out backwards", animationDelay: `${Math.min(i, 12) * 20}ms` }}
                      className={cn(
                        "group relative flex flex-col gap-2.5 rounded-lg border bg-card p-3.5 text-left transition-colors duration-150 cursor-pointer",
                        isSelected
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:border-border-strong",
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
                        {mounted && paletteSwatches(palette[mode]).map(s => (
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
                {mounted && !isPatternDefault && (
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
                {PATTERNS.map((pat, i) => {
                  const isSel = (selectedPatternId ?? DEFAULT_PATTERN_ID) === pat.id
                  return (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() => selectPattern(pat.id)}
                      style={{ animation: "chart-rise 0.25s ease-out backwards", animationDelay: `${Math.min(i, 12) * 20}ms` }}
                      className={cn(
                        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors duration-150 cursor-pointer",
                        isSel
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className={cn("absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full transition-colors duration-150", isSel ? "bg-primary text-primary-foreground" : "bg-transparent")}>
                        <Check className={cn("size-3 transition-opacity", isSel ? "opacity-100" : "opacity-0")} strokeWidth={3} />
                      </span>

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
                {mounted && <PreviewShell palette={preview} mode={mode} />}

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
                {mounted && (
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
