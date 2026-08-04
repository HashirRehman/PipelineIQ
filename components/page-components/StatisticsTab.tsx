import { useState } from 'react'
import type { AppUser, Profile } from '@/app/page'
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

const LEAD_DATA_BY_USER: Record<string, number[]> = {
  u2: [3, 5, 4, 7, 6, 8, 11, 9],
  u3: [2, 3, 5, 4, 8, 6, 7, 10],
  u4: [1, 2, 3, 5, 4, 6, 5, 7],
  u5: [0, 1, 2, 1, 0, 1, 0, 0],
}

const STATUS_DATA = [
  { label: 'Applied', value: 8, color: '#6366f1' },
  { label: 'Screening', value: 5, color: '#f59e0b' },
  { label: 'Interview', value: 4, color: '#06b6d4' },
  { label: 'Technical', value: 3, color: '#ec4899' },
  { label: 'Offer', value: 2, color: '#10b981' },
  { label: 'Closed', value: 6, color: '#64748b' },
]

function BarChart({ data, labels, color = '#06b6d4' }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data, 1)

  return (
    <div className="flex items-end gap-2 h-[152px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className={`font-mono text-[9px] text-[var(--muted-fg)] font-semibold ${v > 0 ? 'visible' : 'invisible'}`}>{v}</div>
          <div className="w-full relative h-[120px] flex items-end">
            <div
              className="w-full rounded-t transition-[height] duration-400 ease-in-out"
              style={{
                background: `linear-gradient(180deg, ${color}, ${color}88)`,
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 4 : 0,
              }}
            />
          </div>
          <div className="font-mono text-[9px] text-[var(--muted-fg)] text-center">{labels[i]}</div>
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
      <path d={fill} fill="rgba(6,182,212,0.08)" />
      {/* Line */}
      <path d={path} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#06b6d4" />
      ))}
      {/* Labels */}
      {labels.map((l, i) => (
        <text key={i} x={pts[i].x} y={h + 16} textAnchor="middle" fill="var(--muted-fg)" fontSize="9" fontFamily="JetBrains Mono, monospace">{l}</text>
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
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--fg)" fontSize="18" fontWeight="700" fontFamily="JetBrains Mono, monospace">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted-fg)" fontSize="8" fontFamily="JetBrains Mono, monospace">TOTAL</text>
      </svg>
      <div className="flex flex-col gap-1.75">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-[var(--fg)]">{s.label}</span>
            <span className="font-mono text-[11px] text-[var(--muted-fg)] ml-auto">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props { profiles: Profile[]; users: AppUser[]; currentUser: AppUser }

export default function StatisticsTab({ profiles, users, currentUser }: Props) {
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
    { label: 'Total Leads', value: totalLeads, sub: `last ${chartData.length} months`, color: '#06b6d4' },
    { label: 'Avg / Month', value: avgPerMonth, sub: granularity, color: '#6366f1' },
    { label: 'Best Month', value: topMonth, sub: `${Math.max(...chartData)} leads`, color: '#10b981' },
    { label: 'Active Profiles', value: profiles.filter(p => p.status === 'active').length, sub: `of ${profiles.length} total`, color: '#f59e0b' },
  ]

  return (
    <div className="p-7 px-8 flex-1 overflow-auto">
      <PageHeader
        title="Lead Statistics"
        subtitle="Performance analytics across profiles and team members"
        className="mb-6 items-start"
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
              <TabsList className="bg-[var(--card)] border border-[var(--border-strong)] rounded-md overflow-hidden p-0 h-auto gap-0 shadow-none">
                {['daily', 'weekly', 'monthly'].map(g => (
                  <TabsTrigger key={g} value={g}
                    className={`h-auto p-2 px-3 border-none rounded-none text-xs shadow-none data-active:bg-cyan-500/15 data-active:text-[var(--primary)] ${
                      granularity === g
                        ? 'bg-cyan-500/15 font-semibold text-[var(--primary)]'
                        : 'bg-transparent font-normal text-[var(--fg)] hover:text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {statsCards.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} color={s.color} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Line chart */}
        <Card className="py-5 px-5 gap-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-none ring-0">
          <CardContent className="p-0">
            <div className="text-xs font-semibold text-[var(--fg)] mb-1">Leads Over Time</div>
            <div className="text-[11px] text-[var(--muted-fg)] mb-4">{granularity} · {userFilter === 'all' ? 'All users' : users.find(u => u.id === userFilter)?.name}</div>
            <LineChart data={chartData} labels={MONTHS} />
          </CardContent>
        </Card>

        {/* Status donut */}
        <Card className="py-5 px-5 gap-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-none ring-0">
          <CardContent className="p-0">
            <div className="text-xs font-semibold text-[var(--fg)] mb-1">Status Breakdown</div>
            <div className="text-[11px] text-[var(--muted-fg)] mb-4">Current lead distribution</div>
            <DonutChart segments={STATUS_DATA} />
          </CardContent>
        </Card>
      </div>

      {/* Per-BD bar charts (admin only) */}
      {isAdmin && userFilter === 'all' && (
        <Card className="py-5 px-5 gap-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-none ring-0 mb-4">
          <CardContent className="p-0">
            <div className="text-xs font-semibold text-[var(--fg)] mb-1">Leads by Team Member</div>
            <div className="text-[11px] text-[var(--muted-fg)] mb-5">Monthly totals per BD</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
              {bdUsers.map((u, i) => {
                const colors = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b']
                const data = LEAD_DATA_BY_USER[u.id] ?? MONTHS.map(() => 0)
                return (
                  <div key={u.id}>
                    <div className="flex items-center gap-1.75 mb-2.5">
                      <div className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: colors[i % colors.length] }}>
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[var(--fg)]">{u.name.split(' ')[0]}</div>
                        <div className="font-mono text-[10px]" style={{ color: colors[i % colors.length] }}>{data.reduce((s, v) => s + v, 0)} total</div>
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
      <Card className="py-5 px-5 gap-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-none ring-0">
        <CardContent className="p-0">
          <div className="text-xs font-semibold text-[var(--fg)] mb-4">Profile Activity</div>
          <div className="flex flex-col">
            {profiles.map((p, i) => {
              const leads = [8, 12, 4, 2, 6][i % 5]
              const maxLeads = 15
              const pct = (leads / maxLeads) * 100
              return (
                <div key={p.id} className={`flex items-center gap-3 py-2.75 ${i < profiles.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                  <Avatar name={p.name} size={30} />
                  <div className="w-[140px] shrink-0">
                    <div className="text-xs font-medium text-[var(--fg)]">{p.name}</div>
                    <div className="font-mono text-[10px] text-[var(--muted-fg)]">{p.seniority} · {p.status}</div>
                  </div>
                  <Progress value={pct} className="flex-1 gap-0"
                    trackClassName="h-1.5 bg-[var(--secondary)]"
                    indicatorClassName="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" />
                  <div className="font-mono w-[60px] text-right text-xs font-bold text-[var(--fg)] shrink-0">
                    {leads} <span className="font-normal text-[var(--muted-fg)] text-[10px]">leads</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
