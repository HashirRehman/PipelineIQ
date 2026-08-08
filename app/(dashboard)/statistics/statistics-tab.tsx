"use client"
import { useState } from 'react'
import { Avatar } from "@/components/avatar"
import { StatCard } from "@/components/stat-card"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { LEAD_STATUS_COLOR } from "@/lib/constants"

// Minimal mock shapes used only while this tab renders static data (no
// analytics API yet). Kept local so the app shell stays clean.
type MockUser = { id: string; name: string; role: 'admin' | 'lead' | 'bd' }
type MockProfile = { id: string; name: string; seniority: string; status: 'active' | 'inactive' }

const MOCK_USERS: MockUser[] = [
  { id: 'u1', name: 'Alex Rivera', role: 'admin' },
  { id: 'u2', name: 'Jamie Park', role: 'bd' },
  { id: 'u3', name: 'Morgan Lee', role: 'bd' },
  { id: 'u4', name: 'Casey Torres', role: 'lead' },
  { id: 'u5', name: 'Dana Shah', role: 'bd' },
]

const MOCK_CURRENT_USER: MockUser = MOCK_USERS[0]

const MOCK_PROFILES: MockProfile[] = [
  { id: 'p1', name: 'Sarah Chen', seniority: 'Senior', status: 'active' },
  { id: 'p2', name: 'Marcus Webb', seniority: 'Lead', status: 'active' },
  { id: 'p3', name: 'Priya Nair', seniority: 'Mid', status: 'active' },
  { id: 'p4', name: 'Jordan Kim', seniority: 'Principal', status: 'inactive' },
  { id: 'p5', name: 'Nia Okonkwo', seniority: 'Senior', status: 'active' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

const LEAD_DATA_BY_USER: Record<string, number[]> = {
  u2: [3, 5, 4, 7, 6, 8, 11, 9],
  u3: [2, 3, 5, 4, 8, 6, 7, 10],
  u4: [1, 2, 3, 5, 4, 6, 5, 7],
  u5: [0, 1, 2, 1, 0, 1, 0, 0],
}

const STATUS_DATA = [
  { label: 'Applied', value: 8, color: LEAD_STATUS_COLOR['Applied'] },
  { label: 'Screening', value: 5, color: LEAD_STATUS_COLOR['HR Interview'] },
  { label: 'Interview', value: 4, color: LEAD_STATUS_COLOR['Tech Interview 1'] },
  { label: 'Technical', value: 3, color: LEAD_STATUS_COLOR['Client Interview'] },
  { label: 'Offer', value: 2, color: LEAD_STATUS_COLOR['Offer Received'] },
  { label: 'Closed', value: 6, color: LEAD_STATUS_COLOR['Closed'] },
]

function BarChart({ data, labels, color = 'var(--brand-blue)' }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data, 1)

  return (
    <div className="flex items-end gap-2 h-[152px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className={`font-mono text-micro text-muted-foreground font-semibold ${v > 0 ? 'visible' : 'invisible'}`}>{v}</div>
          <div className="w-full relative h-[120px] flex items-end">
            <div
              className="w-full rounded-t transition-[height] duration-400 ease-in-out"
              style={{
                background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 53%, transparent))`,
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 4 : 0,
              }}
            />
          </div>
          <div className="font-mono text-micro text-muted-foreground text-center">{labels[i]}</div>
        </div>
      ))}
    </div>
  )
}

function LineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1)
  const w = 400
  const h = 100
  const pad = { l: 8, r: 8, t: 10, b: 0 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b

  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * innerW,
    y: pad.t + (1 - v / max) * innerH,
  }))

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fill = `${path} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-auto overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad.l} y1={pad.t + f * innerH} x2={w - pad.r} y2={pad.t + f * innerH}
          stroke="var(--border)" strokeWidth="0.5" />
      ))}
      {/* Fill */}
      <path d={fill} fill="color-mix(in srgb, var(--brand-blue) 8%, transparent)" />
      {/* Line */}
      <path d={path} fill="none" stroke="var(--brand-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--brand-blue)" />
      ))}
      {/* Labels */}
      {labels.map((l, i) => (
        <text key={i} x={pts[i].x} y={h + 16} textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-mono)" }}>{l}</text>
      ))}
    </svg>
  )
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const r = 52
  const cx = 70
  const cy = 70

  const arcs = segments.reduce<{ label: string; value: number; color: string; startAngle: number; sweep: number }[]>((arr, seg) => {
    const prev = arr[arr.length - 1]
    const startAngle = prev ? prev.startAngle + prev.sweep : -Math.PI / 2
    const sweep = (seg.value / total) * 2 * Math.PI
    arr.push({ ...seg, startAngle, sweep })
    return arr
  }, [])

  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        {arcs.map((seg, i) => {
          const x1 = cx + r * Math.cos(seg.startAngle)
          const y1 = cy + r * Math.sin(seg.startAngle)
          const x2 = cx + r * Math.cos(seg.startAngle + seg.sweep)
          const y2 = cy + r * Math.sin(seg.startAngle + seg.sweep)
          const largeArc = seg.sweep > Math.PI ? 1 : 0
          return (
            <path key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={seg.color} opacity="0.85"
            />
          )
        })}
        <circle cx={cx} cy={cy} r={r * 0.58} fill="var(--card)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--page-fg)" style={{ fontSize: "var(--text-lg)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: "var(--text-nano)", fontFamily: "var(--font-mono)" }}>TOTAL</text>
      </svg>
      <div className="flex flex-col gap-1.75">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-foreground">{s.label}</span>
            <span className="font-mono text-meta text-muted-foreground ml-auto">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatisticsTab() {
  const profiles = MOCK_PROFILES
  const users = MOCK_USERS
  const currentUser = MOCK_CURRENT_USER

  const [userFilter, setUserFilter] = useState(currentUser.role === 'admin' ? 'all' : currentUser.id)
  const [profileFilter, setProfileFilter] = useState('all')
  const [granularity, setGranularity] = useState('monthly')
  const [dateRange, setDateRange] = useState('6mo')

  const bdUsers = users.filter(u => u.role === 'bd' || u.role === 'lead')
  const isAdmin = currentUser.role === 'admin'

  const getChartData = () => {
    if (userFilter === 'all') {
      return MONTHS.map((_, i) => Object.values(LEAD_DATA_BY_USER).reduce((s, arr) => s + arr[i], 0))
    }
    return LEAD_DATA_BY_USER[userFilter] ?? MONTHS.map(() => 0)
  }

  const chartData = getChartData()
  const totalLeads = chartData.reduce((s, v) => s + v, 0)
  const avgPerMonth = (totalLeads / chartData.length).toFixed(1)
  const topMonth = MONTHS[chartData.indexOf(Math.max(...chartData))]

  const statsCards = [
    { label: 'Total Leads', value: totalLeads, sub: `last ${chartData.length} months`, color: 'var(--brand-blue)' },
    { label: 'Avg / Month', value: avgPerMonth, sub: granularity, color: 'var(--brand-sky)' },
    { label: 'Best Month', value: topMonth, sub: `${Math.max(...chartData)} leads`, color: 'var(--status-green)' },
    { label: 'Active Profiles', value: profiles.filter(p => p.status === 'active').length, sub: `of ${profiles.length} total`, color: 'var(--status-amber)' },
  ]

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Lead Statistics"
        description="Performance analytics across profiles and team members"
        actions={
          <>
            {isAdmin && (
              <Select value={userFilter} onValueChange={v => setUserFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {bdUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={profileFilter} onValueChange={v => setProfileFilter(v ?? 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Profiles</SelectItem>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={v => setDateRange(v ?? '6mo')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1mo">Last month</SelectItem>
                <SelectItem value="3mo">Last 3 months</SelectItem>
                <SelectItem value="6mo">Last 6 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={granularity} onValueChange={v => setGranularity(v ?? 'monthly')}>
              <TabsList className="rounded-md border border-border overflow-hidden p-0 h-auto gap-0 shadow-none bg-card">
                {['daily', 'weekly', 'monthly'].map(g => (
                  <TabsTrigger key={g} value={g}
                    className={`h-auto p-2 px-3 border-none rounded-none text-xs shadow-none ${
                      granularity === g
                        ? 'bg-primary/15 font-semibold text-primary'
                        : 'bg-transparent font-normal text-foreground hover:bg-accent'
                    }`}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsCards.map(s => (
            <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} color={s.color} />
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Line chart */}
          <Card className="gap-0 p-5">
            <CardContent className="p-0">
              <div className="text-sm font-semibold text-foreground mb-1">Leads Over Time</div>
              <div className="text-meta text-muted-foreground mb-4">{granularity} · {userFilter === 'all' ? 'All users' : users.find(u => u.id === userFilter)?.name}</div>
              <LineChart data={chartData} labels={MONTHS} />
            </CardContent>
          </Card>

          {/* Status donut */}
          <Card className="gap-0 p-5">
            <CardContent className="p-0">
              <div className="text-sm font-semibold text-foreground mb-1">Status Breakdown</div>
              <div className="text-meta text-muted-foreground mb-4">Current lead distribution</div>
              <DonutChart segments={STATUS_DATA} />
            </CardContent>
          </Card>
        </div>

        {/* Per-BD bar charts (admin only) */}
        {isAdmin && userFilter === 'all' && (
          <Card className="gap-0 p-5">
            <CardContent className="p-0">
              <div className="text-sm font-semibold text-foreground mb-1">Leads by Team Member</div>
              <div className="text-meta text-muted-foreground mb-5">Monthly totals per BD</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
                {bdUsers.map((u, i) => {
                  const colors = ['var(--brand-blue)', 'var(--brand-sky)', 'var(--status-green)', 'var(--status-amber)']
                  const data = LEAD_DATA_BY_USER[u.id] ?? MONTHS.map(() => 0)
                  return (
                    <div key={u.id}>
                      <div className="flex items-center gap-1.75 mb-2.5">
                        <div className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-micro font-bold text-white" style={{ background: colors[i % colors.length] }}>
                          {u.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-foreground">{u.name.split(' ')[0]}</div>
                          <div className="font-mono text-caption" style={{ color: colors[i % colors.length] }}>{data.reduce((s, v) => s + v, 0)} total</div>
                        </div>
                      </div>
                      <BarChart data={data.slice(-5)} labels={MONTHS.slice(-5)} color={colors[i % colors.length]} />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile performance */}
        <Card className="gap-0 p-5">
          <CardContent className="p-0">
            <div className="text-sm font-semibold text-foreground mb-4">Profile Activity</div>
            <div className="flex flex-col">
              {profiles.map((p, i) => {
                const leads = [8, 12, 4, 2, 6][i % 5]
                const maxLeads = 15
                const pct = (leads / maxLeads) * 100
                return (
                  <div key={p.id} className={`flex items-center gap-3 py-2.75 ${i < profiles.length - 1 ? 'border-b border-border' : ''}`}>
                    <Avatar name={p.name} size={30} />
                    <div className="w-[140px] shrink-0">
                      <div className="text-xs font-medium text-foreground">{p.name}</div>
                      <div className="font-mono text-caption text-muted-foreground">{p.seniority} · {p.status}</div>
                    </div>
                    <Progress value={pct} className="flex-1 gap-0"
                      trackClassName="h-1.5 bg-muted"
                      indicatorClassName="h-full bg-gradient-to-r from-brand-blue to-brand-sky rounded-full" />
                    <div className="font-mono w-[60px] text-right text-xs font-bold text-foreground shrink-0">
                      {leads} <span className="font-normal text-muted-foreground text-caption">leads</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
