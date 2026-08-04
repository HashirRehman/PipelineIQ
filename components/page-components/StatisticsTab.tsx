import { useState } from 'react'
import type { AppUser, Profile } from '@/app/page'

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
  const h = 120

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: h + 32 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted-fg)', fontWeight: 600, visibility: v > 0 ? 'visible' : 'hidden' }}>{v}</div>
          <div style={{ width: '100%', position: 'relative', height: h, display: 'flex', alignItems: 'flex-end' }}>
            <div
              style={{
                width: '100%', borderRadius: '3px 3px 0 0',
                background: `linear-gradient(180deg, ${color}, ${color}88)`,
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 4 : 0,
                transition: 'height 0.4s ease',
              }}
            />
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted-fg)', textAlign: 'center' }}>{labels[i]}</div>
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
    <svg viewBox={`0 0 ${w} ${h + 20}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
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
  let angle = -Math.PI / 2

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {segments.map((seg, i) => {
          const startAngle = angle
          const sweep = (seg.value / total) * 2 * Math.PI
          angle += sweep
          const x1 = cx + r * Math.cos(startAngle)
          const y1 = cy + r * Math.sin(startAngle)
          const x2 = cx + r * Math.cos(startAngle + sweep)
          const y2 = cy + r * Math.sin(startAngle + sweep)
          const largeArc = sweep > Math.PI ? 1 : 0
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--fg)' }}>{s.label}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted-fg)', marginLeft: 'auto' }}>{s.value}</span>
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
    <div style={{ padding: '28px 32px', flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Lead Statistics</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-fg)', margin: '3px 0 0' }}>Performance analytics across profiles and team members</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
              style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13 }}>
              <option value="all">All Users</option>
              {bdUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select value={profileFilter} onChange={e => setProfileFilter(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13 }}>
            <option value="all">All Profiles</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13 }}>
            <option value="1mo">Last month</option>
            <option value="3mo">Last 3 months</option>
            <option value="6mo">Last 6 months</option>
            <option value="1y">Last year</option>
          </select>
          <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
            {['daily', 'weekly', 'monthly'].map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                style={{ padding: '8px 12px', background: granularity === g ? 'rgba(6,182,212,0.15)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: granularity === g ? 600 : 400, color: granularity === g ? 'var(--primary)' : 'var(--fg)' }}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {statsCards.map(s => (
          <div key={s.label} style={{ padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Line chart */}
        <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>Leads Over Time</div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginBottom: 16 }}>{granularity} · {userFilter === 'all' ? 'All users' : users.find(u => u.id === userFilter)?.name}</div>
          <LineChart data={chartData} labels={MONTHS} />
        </div>

        {/* Status donut */}
        <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>Status Breakdown</div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginBottom: 16 }}>Current lead distribution</div>
          <DonutChart segments={STATUS_DATA} />
        </div>
      </div>

      {/* Per-BD bar charts (admin only) */}
      {isAdmin && userFilter === 'all' && (
        <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>Leads by Team Member</div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginBottom: 20 }}>Monthly totals per BD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24 }}>
            {bdUsers.map((u, i) => {
              const colors = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b']
              const data = LEAD_DATA_BY_USER[u.id] ?? MONTHS.map(() => 0)
              return (
                <div key={u.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>
                      {u.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)' }}>{u.name.split(' ')[0]}</div>
                      <div className="mono" style={{ fontSize: 10, color: colors[i % colors.length] }}>{data.reduce((s, v) => s + v, 0)} total</div>
                    </div>
                  </div>
                  <BarChart data={data.slice(-5)} labels={MONTHS.slice(-5)} color={colors[i % colors.length]} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Profile performance */}
      <div style={{ padding: '20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 16 }}>Profile Activity</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {profiles.map((p, i) => {
            const leads = [8, 12, 4, 2, 6][i % 5]
            const maxLeads = 15
            const pct = (leads / maxLeads) * 100
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < profiles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,#06b6d4,#6366f1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {p.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ width: 140, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--muted-fg)' }}>{p.seniority} · {p.status}</div>
                </div>
                <div style={{ flex: 1, height: 6, background: 'var(--secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#06b6d4,#6366f1)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div className="mono" style={{ width: 60, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--fg)', flexShrink: 0 }}>
                  {leads} <span style={{ fontWeight: 400, color: 'var(--muted-fg)', fontSize: 10 }}>leads</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
