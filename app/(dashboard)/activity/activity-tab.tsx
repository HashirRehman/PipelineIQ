"use client"

import { useEffect, useState } from "react"
import { Activity as ActivityIcon } from "lucide-react"
import type { ApiActivity, ApiActivityUser } from "@/app/api/activity/route"
import { ACTIVITY_ACTION_LABELS, ACTIVITY_ACTIONS, type ActivityAction } from "@/lib/api/activity"
import { withOrgId } from "@/lib/api/client"
import { Avatar } from "@/components/avatar"
import { GooeyInput } from "@/components/ui/gooey-input"
import { Pagination } from "@/components/jobs/pagination"
import { ResultsCount } from "@/components/results-count"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DATE_RANGES, type DateRange } from "@/lib/constants"
import { dateRangeLabel, getDateWindow } from "@/lib/date-window"
import { formatDate, timeAgo } from "@/lib/format"

const PAGE_SIZE = 50

interface ActivityResponse {
  activities: ApiActivity[]
  users: ApiActivityUser[]
  actions: ActivityAction[]
  canViewAll: boolean
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

const buildQueryKey = (opts: {
  page: number
  search: string
  action: string
  userId: string
  dateRange: DateRange
}) => {
  const params = new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    search: opts.search,
    action: opts.action === "all" ? "" : opts.action,
    userId: opts.userId === "all" ? "" : opts.userId,
  })
  const window = getDateWindow(opts.dateRange)
  if (window) {
    params.set("from", window.from)
    params.set("to", window.to)
  }
  return params.toString()
}

export default function ActivityTab() {
  const [activities, setActivities] = useState<ApiActivity[]>([])
  const [users, setUsers] = useState<ApiActivityUser[]>([])
  const [canViewAll, setCanViewAll] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [dateRange, setDateRange] = useState<DateRange>("all")

  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadingKey = buildQueryKey({ page, search, action: actionFilter, userId: userFilter, dateRange })
  const loading = appliedKey !== loadingKey

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(withOrgId(`/api/activity?${loadingKey}`), { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error("Failed to load activity")
        return res.json() as Promise<ActivityResponse>
      })
      .then(json => {
        setActivities(json.activities)
        setUsers(json.users ?? [])
        setCanViewAll(json.canViewAll ?? false)
        setTotalCount(json.totalCount)
        setTotalPages(json.totalPages)
        if (page > json.totalPages) setPage(Math.max(1, json.totalPages))
        setAppliedKey(loadingKey)
        setError(null)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Failed to load activity")
        setAppliedKey(loadingKey)
      })
    return () => ctrl.abort()
  }, [loadingKey, page])

  const changeSearch = (v: string) => { setSearch(v); setPage(1) }
  const changeAction = (v: string) => { setActionFilter(v ?? "all"); setPage(1) }
  const changeUser = (v: string) => { setUserFilter(v ?? "all"); setPage(1) }
  const changeDateRange = (v: DateRange) => { setDateRange(v); setPage(1) }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* Toolbar — search + filters inline (this feed doesn't need a full
          sidebar; it has three simple filters, unlike Discovery/Pipeline). */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-border bg-background shrink-0">
        <GooeyInput
          value={search}
          onValueChange={changeSearch}
          placeholder="Search activity by person, action, or item…"
          expandedWidth={320}
        />
        <div className="flex items-center gap-2">
          {canViewAll && (
            <Select value={userFilter} onValueChange={v => changeUser(v ?? "all")}>
              <SelectTrigger size="sm" className="h-8 w-[150px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Everyone</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={actionFilter} onValueChange={v => changeAction(v ?? "all")}>
            <SelectTrigger size="sm" className="h-8 w-[160px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All actions</SelectItem>
              {ACTIVITY_ACTIONS.map(a => (
                <SelectItem key={a} value={a} className="text-xs">{ACTIVITY_ACTION_LABELS[a]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={v => changeDateRange((v ?? "all") as DateRange)}>
            <SelectTrigger size="sm" className="h-8 w-[130px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value} className="text-xs">
                  {dateRangeLabel(range.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border">
            <ActivityIcon className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || actionFilter !== "all" || userFilter !== "all" || dateRange !== "all"
                ? "Try adjusting your search or filters."
                : canViewAll
                  ? "Actions across the team will show up here."
                  : "Your actions across the app will show up here."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center pb-3">
              <ResultsCount count={totalCount} label="events" />
            </div>
            <ul role="list" className="flex flex-col gap-2">
              {activities.map(a => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Avatar name={a.actorName} size={32} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{a.actorName}</span>{" "}
                      <span className="text-muted-foreground">{a.description}</span>
                    </p>
                    <p className="text-caption text-muted-foreground/70 mt-0.5">
                      {ACTIVITY_ACTION_LABELS[a.action] ?? a.action} · {timeAgo(a.createdAt)}
                    </p>
                  </div>
                  <span
                    title={formatDate(a.createdAt)}
                    className="shrink-0 text-caption text-muted-foreground/60 tabular-nums"
                  >
                    {formatDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onChange={setPage} className="mt-6" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
