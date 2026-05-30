'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Users,
  LifeBuoy,
  AlertTriangle,
  Search,
  Stethoscope,
  Anchor,
  Plus,
  MapPin,
  Activity,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react'
import { useRoleView } from '@/components/shell/RoleViewProvider'
import { FieldActionSheet, type FieldActionMode } from '@/components/forms/FieldActionSheet'
import { OpsPanel } from './OpsPanel'
import type {
  CoverageRow,
  Incident,
  IncidentCounters,
  RescueTeam,
  RescueTeamType,
  RiskLevel,
  VulnerablePerson,
} from '@/types'

const EocMap = dynamic(() => import('./EocMap'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-[var(--bg-sunken)]">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
        loading map
      </span>
    </div>
  ),
})

interface TriageRequest {
  id: string
  requestType: string
  priority: string
  status: string
  description: string
  observedAt: string
  memberName: string
}

interface Props {
  persons: VulnerablePerson[]
  activeIncidents: Incident[]
  rescueTeams: RescueTeam[]
  requests: TriageRequest[]
  coverageRows: CoverageRow[]
  counters: IncidentCounters | null
  incidentId: string | null
  realRole: string
}

type Segment = 'roster' | 'requests' | 'teams' | 'ops'

interface GeoRow {
  name: string
  total: number
  flood: number
  near: number
  safe: number
}

const RISK_RANK: Record<RiskLevel, number> = { flood: 0, near: 1, safe: 2 }
const riskColor: Record<RiskLevel, string> = {
  flood: 'var(--risk-flood)',
  near: 'var(--risk-near)',
  safe: 'var(--risk-safe)',
}
const riskLabel: Record<RiskLevel, string> = { flood: 'ในเขตน้ำท่วม', near: 'ใกล้เขต', safe: 'ปลอดภัย' }

const teamTypeLabel: Record<RescueTeamType, string> = {
  rescue_boat: 'เรือกู้ภัยน้ำหลาก',
  gmc_truck: 'รถบรรทุกลุยน้ำ GMC',
  ems_medical: 'หน่วยแพทย์สนามฉุกเฉิน',
  mcat_psych: 'หน่วยสุขภาพจิต MCAT',
  volunteer_kitchen: 'ครัวพระราชทาน/อาหาร',
  other: 'อื่นๆ',
}
const TEAM_TYPES = Object.keys(teamTypeLabel) as RescueTeamType[]

const priorityRank = (p: string) => (p === 'critical' ? 0 : p === 'high' ? 1 : p === 'normal' ? 2 : 3)
const priorityMeta = (p: string): { tone: string; label: string } =>
  p === 'critical'
    ? { tone: 'var(--risk-flood)', label: 'วิกฤต' }
    : p === 'high'
      ? { tone: 'var(--risk-flood)', label: 'เร่งด่วน' }
      : p === 'normal'
        ? { tone: 'var(--risk-near)', label: 'เฝ้าระวัง' }
        : { tone: 'var(--risk-safe)', label: 'เตรียมแผน' }

export function EocDashboard({ persons, activeIncidents, rescueTeams, requests, coverageRows, counters, incidentId, realRole }: Props) {
  const router = useRouter()
  const { viewRole } = useRoleView()
  const canCommand = viewRole === 'officer' || viewRole === 'admin'

  const [seg, setSeg] = useState<Segment>('roster')
  const [viewMode, setViewMode] = useState<'cards' | 'table-risk' | 'table-type'>('cards')
  const [search, setSearch] = useState('')
  const [drill, setDrill] = useState<{ amphoe?: string; tambon?: string; vil?: string }>({})
  const [selected, setSelected] = useState<VulnerablePerson | null>(null)
  const [action, setAction] = useState<{ id: string; name: string; mode: FieldActionMode } | null>(null)

  const counts = useMemo(() => {
    const flood = persons.filter((p) => p.risk === 'flood').length
    const near = persons.filter((p) => p.risk === 'near').length
    const safe = persons.filter((p) => p.risk === 'safe').length
    const open = requests.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled').length
    return { total: persons.length, flood, near, safe, open, teams: rescueTeams.length }
  }, [persons, requests, rescueTeams])

  // ── geo drill: amphoe → tambon → village → people ──
  const isSearching = search.trim().length > 0
  const drillLevel: 'amphoe' | 'tambon' | 'vil' | 'people' =
    !drill.amphoe ? 'amphoe' : !drill.tambon ? 'tambon' : !drill.vil ? 'vil' : 'people'

  const personsScope = useMemo(() => {
    if (isSearching) {
      const q = search.toLowerCase()
      return persons.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.cond ?? '').toLowerCase().includes(q) ||
        (p.vil ?? '').toLowerCase().includes(q) ||
        (p.tambon ?? '').toLowerCase().includes(q) ||
        (p.amphoe ?? '').toLowerCase().includes(q),
      )
    }
    return persons.filter((p) =>
      (!drill.amphoe || (p.amphoe ?? 'ไม่ระบุ') === drill.amphoe) &&
      (!drill.tambon || (p.tambon ?? 'ไม่ระบุ') === drill.tambon) &&
      (!drill.vil    || (p.vil    ?? 'ไม่ระบุ') === drill.vil),
    )
  }, [persons, drill, isSearching, search])

  const groupRows = useMemo(() => {
    if (isSearching || drillLevel === 'people') return [] as GeoRow[]
    const key: 'amphoe' | 'tambon' | 'vil' = drillLevel
    const m = new Map<string, VulnerablePerson[]>()
    for (const p of personsScope) {
      const k = (p[key] as string | undefined) ?? 'ไม่ระบุ'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return Array.from(m.entries())
      .map(([name, ppl]) => ({
        name,
        total: ppl.length,
        flood: ppl.filter((x) => x.risk === 'flood').length,
        near:  ppl.filter((x) => x.risk === 'near').length,
        safe:  ppl.filter((x) => x.risk === 'safe').length,
      }))
      .sort((a, b) => b.flood - a.flood || b.total - a.total)
  }, [personsScope, drillLevel, isSearching])

  // people list — used when fully drilled OR when searching
  const leafPeople = useMemo(() => {
    if (!isSearching && drillLevel !== 'people') return [] as VulnerablePerson[]
    return [...personsScope].sort(
      (a, b) => RISK_RANK[(a.risk ?? 'safe') as RiskLevel] - RISK_RANK[(b.risk ?? 'safe') as RiskLevel] ||
                a.name.localeCompare(b.name, 'th'),
    )
  }, [personsScope, drillLevel, isSearching])

  // ── flat aggregation: amphoe / tambon / vil with counts (สำหรับ "ตาราง") ──
  const flatRows = useMemo(() => {
    const m = new Map<string, {
      amphoe: string; tambon: string; vil: string; total: number
      flood: number; near: number; safe: number
      bedridden: number; elderly: number; disabled: number; pregnant: number
    }>()
    for (const p of personsScope) {
      const amphoe = p.amphoe ?? 'ไม่ระบุ'
      const tambon = p.tambon ?? 'ไม่ระบุ'
      const vil = p.vil ?? 'ไม่ระบุ'
      const k = `${amphoe}|${tambon}|${vil}`
      const cur = m.get(k) ?? {
        amphoe, tambon, vil, total: 0,
        flood: 0, near: 0, safe: 0,
        bedridden: 0, elderly: 0, disabled: 0, pregnant: 0,
      }
      cur.total += 1
      cur[(p.risk ?? 'safe') as RiskLevel] += 1
      if (p.type === 'bedridden' || p.type === 'elderly' || p.type === 'disabled' || p.type === 'pregnant') {
        cur[p.type] += 1
      }
      m.set(k, cur)
    }
    return Array.from(m.values())
  }, [personsScope])

  const flatRowsByRisk = useMemo(
    () => [...flatRows].sort((a, b) =>
      b.flood - a.flood || b.near - a.near ||
      a.amphoe.localeCompare(b.amphoe, 'th') ||
      a.tambon.localeCompare(b.tambon, 'th') ||
      a.vil.localeCompare(b.vil, 'th'),
    ),
    [flatRows],
  )

  const flatRowsByType = useMemo(
    () => [...flatRows].sort((a, b) =>
      b.bedridden - a.bedridden || b.disabled - a.disabled || b.elderly - a.elderly ||
      a.amphoe.localeCompare(b.amphoe, 'th') ||
      a.tambon.localeCompare(b.tambon, 'th') ||
      a.vil.localeCompare(b.vil, 'th'),
    ),
    [flatRows],
  )

  // ── coverage rows scoped by current drill (normal-mode) ──
  const coverageScoped = useMemo(() => {
    const rows = coverageRows.filter((r) =>
      (!drill.amphoe || r.amphoe === drill.amphoe) &&
      (!drill.tambon || r.tambon === drill.tambon) &&
      (!drill.vil    || r.vil    === drill.vil),
    )
    // aggregate by current drill level
    const key: 'amphoe' | 'tambon' | 'vil' =
      !drill.amphoe ? 'amphoe' : !drill.tambon ? 'tambon' : 'vil'
    const m = new Map<string, { total: number; visited: number; lastVisitMs: number | null; daysSince: number | null }>()
    for (const r of rows) {
      const k = r[key]
      const cur = m.get(k) ?? { total: 0, visited: 0, lastVisitMs: null, daysSince: null }
      cur.total += r.totalMembers
      cur.visited += r.visitedIn90d
      const ms = r.lastVisitAt ? new Date(r.lastVisitAt).getTime() : null
      if (ms !== null && (cur.lastVisitMs === null || ms > cur.lastVisitMs)) {
        cur.lastVisitMs = ms
        cur.daysSince = r.daysSinceLastVisit
      }
      m.set(k, cur)
    }
    return Array.from(m.entries())
      .map(([name, d]) => ({
        name,
        total: d.total,
        visited: d.visited,
        pct: d.total > 0 ? Math.round((d.visited / d.total) * 100) : 0,
        daysSince: d.daysSince,
      }))
      .sort((a, b) => a.pct - b.pct || (b.daysSince ?? 0) - (a.daysSince ?? 0))
  }, [coverageRows, drill])

  function drillInto(name: string) {
    if (!drill.amphoe) setDrill({ amphoe: name })
    else if (!drill.tambon) setDrill({ ...drill, tambon: name })
    else if (!drill.vil) setDrill({ ...drill, vil: name })
  }

  const levelNoun = drillLevel === 'amphoe' ? 'อำเภอ' : drillLevel === 'tambon' ? 'ตำบล' : drillLevel === 'vil' ? 'หมู่บ้าน' : ''

  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
    [requests],
  )

  const isNormalMode = activeIncidents.length === 0
  const totalCoverage = useMemo(() => {
    const total = coverageRows.reduce((s, r) => s + r.totalMembers, 0)
    const visited = coverageRows.reduce((s, r) => s + r.visitedIn90d, 0)
    const neverVisited = coverageRows.filter((r) => r.lastVisitAt === null).reduce((s, r) => s + r.totalMembers, 0)
    return { total, visited, pct: total > 0 ? Math.round((visited / total) * 100) : 0, neverVisited }
  }, [coverageRows])

  const ribbon = isNormalMode
    ? [
        { label: 'กลุ่มเปราะบาง', value: counts.total, tone: 'var(--fg)' },
        { label: 'เยี่ยมใน 90 วัน', value: totalCoverage.visited, tone: 'var(--risk-safe)' },
        { label: 'ครอบคลุม %', value: totalCoverage.pct, tone: totalCoverage.pct < 50 ? 'var(--risk-flood)' : totalCoverage.pct < 80 ? 'var(--risk-near)' : 'var(--risk-safe)' },
        { label: 'ยังไม่เคยเยี่ยม', value: totalCoverage.neverVisited, tone: totalCoverage.neverVisited > 0 ? 'var(--risk-flood)' : 'var(--fg)' },
        { label: 'หมู่บ้าน', value: coverageRows.length, tone: 'var(--signal-data)' },
      ]
    : [
        { label: 'กลุ่มเปราะบาง', value: counts.total, tone: 'var(--fg)' },
        { label: 'ในเขตน้ำท่วม', value: counts.flood, tone: 'var(--risk-flood)' },
        { label: 'เฝ้าระวัง', value: counts.near, tone: 'var(--risk-near)' },
        { label: 'ปลอดภัย', value: counts.safe, tone: 'var(--risk-safe)' },
        { label: 'คำร้องเปิด', value: counts.open, tone: counts.open ? 'var(--risk-flood)' : 'var(--fg)' },
        { label: 'ทีมกู้ภัย', value: counts.teams, tone: 'var(--signal-data)' },
      ]

  return (
    <div className="mx-auto max-w-7xl">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">ศูนย์บัญชาการ · {realRole}</p>
          <h1 className="gx-title mt-1">ศูนย์ตอบโต้ภัยพิบัติสุขภาพ</h1>
        </div>
        {/* ป้ายสถานะโหมด — read-only, สะท้อนจาก incident scope (เปลี่ยนโหมดที่ IncidentSwitcher บน Masthead) */}
        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm font-medium ${
            isNormalMode
              ? 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)]'
              : 'border-[var(--risk-flood)] bg-[var(--risk-flood)] text-white'
          }`}
          title={isNormalMode ? 'โหมดเฝ้าระวังปกติ — เลือกเหตุการณ์ที่แถบบนเพื่อเข้าโหมดวิกฤต' : 'กำลังจัดการเหตุการณ์ — ออกโหมดวิกฤตได้ที่แถบเหตุการณ์'}
        >
          {!isNormalMode && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
          )}
          {isNormalMode ? 'โหมดปกติ' : 'โหมดวิกฤต'}
        </div>
      </div>

      {/* status ribbon — numbers as typography, not cards */}
      <div className="mt-5 flex flex-wrap items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {ribbon.map((s, i) => (
          <div key={s.label} className={`flex flex-col px-5 py-3 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">{s.label}</span>
            <span className="font-mono text-[26px] font-semibold leading-tight" style={{ color: s.tone }}>{s.value}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 px-5 py-3 text-xs text-[var(--fg-muted)]">
          {activeIncidents[0] ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--risk-flood)] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--risk-flood)]" />
              </span>
              <span className="font-medium text-[var(--fg)]">{activeIncidents[0].name}</span>
            </>
          ) : (
            <span>ไม่มีเหตุการณ์ที่กำลังเกิด</span>
          )}
        </div>
      </div>

      {isNormalMode && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--fg-muted)]">
          <Activity size={15} className="shrink-0 text-[var(--signal-data)]" />
          <span>โหมดปกติ — แสดง<span className="font-medium text-[var(--fg)]">ความครอบคลุมการเยี่ยมผู้เปราะบาง</span>รายพื้นที่ เพื่อเตรียมพร้อมรับมือ · เลือกเหตุการณ์ที่มุมขวาบนเพื่อสลับโหมดวิกฤต</span>
        </div>
      )}

      {/* working area */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* MAIN — worklist */}
        <section className="lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-[var(--bg-sunken)] p-1 text-sm">
              <SegBtn active={seg === 'roster'} onClick={() => { setSeg('roster') }} count={counts.total}>พื้นที่</SegBtn>
              <SegBtn active={seg === 'requests'} onClick={() => setSeg('requests')} count={counts.open} urgent={counts.open > 0}>คำร้อง / Triage</SegBtn>
              <SegBtn active={seg === 'teams'} onClick={() => setSeg('teams')} count={counts.teams}>ทีมกู้ภัย</SegBtn>
              {counters && incidentId && (
                <SegBtn active={seg === 'ops'} onClick={() => setSeg('ops')}>ปฏิบัติการ / Sit Rep</SegBtn>
              )}
            </div>
            {seg === 'roster' && activeIncidents.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 text-xs">
                  {[
                    { v: 'cards', icon: <LayoutGrid size={13} />, label: 'การ์ด', title: 'มุมมองการ์ด (drill ทีละชั้น)' },
                    { v: 'table-risk', icon: <TableIcon size={13} />, label: 'ตาราง · เร่งด่วน', title: 'ตารางนับตามระดับความเร่งด่วน' },
                    { v: 'table-type', icon: <TableIcon size={13} />, label: 'ตาราง · ประเภท', title: 'ตารางนับตามประเภทกลุ่มเปราะบาง' },
                  ].map((b) => (
                    <button
                      key={b.v}
                      type="button"
                      onClick={() => setViewMode(b.v as typeof viewMode)}
                      title={b.title}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors ${viewMode === b.v ? 'bg-[var(--bg-sunken)] font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
                    >
                      {b.icon} {b.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นชื่อทันที (ข้ามการ drill)"
                    className="w-64 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            )}
          </div>

          {seg === 'roster' && (
            <>
              {/* Breadcrumb */}
              {!isSearching && (
                <div className="mb-2.5 flex flex-wrap items-center gap-1 text-sm">
                  <button onClick={() => setDrill({})} className={`rounded px-2 py-1 transition-colors ${!drill.amphoe ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}>
                    ทั้งหมด
                  </button>
                  {drill.amphoe && (
                    <>
                      <ChevronRight size={14} className="text-[var(--fg-subtle)]" />
                      <button
                        onClick={() => setDrill({ amphoe: drill.amphoe })}
                        className={`rounded px-2 py-1 transition-colors ${!drill.tambon ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
                      >
                        อ.{drill.amphoe}
                      </button>
                    </>
                  )}
                  {drill.tambon && (
                    <>
                      <ChevronRight size={14} className="text-[var(--fg-subtle)]" />
                      <button
                        onClick={() => setDrill({ amphoe: drill.amphoe, tambon: drill.tambon })}
                        className={`rounded px-2 py-1 transition-colors ${!drill.vil ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
                      >
                        ต.{drill.tambon}
                      </button>
                    </>
                  )}
                  {drill.vil && (
                    <>
                      <ChevronRight size={14} className="text-[var(--fg-subtle)]" />
                      <span className="rounded px-2 py-1 font-semibold text-[var(--fg)]">{drill.vil}</span>
                    </>
                  )}
                  {(drill.amphoe || drill.tambon || drill.vil) && (
                    <button onClick={() => setDrill({})} className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--fg-subtle)] hover:text-[var(--fg)]">
                      <ArrowLeft size={11} /> reset
                    </button>
                  )}
                  {levelNoun && (
                    <span className="ml-auto text-xs text-[var(--fg-subtle)]">
                      แสดงรายการ {levelNoun} · เรียงตามความเร่งด่วน
                    </span>
                  )}
                </div>
              )}

              {/* ── Normal-mode: coverage view ── */}
              {activeIncidents.length === 0 && !isSearching ? (
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                      ความครอบคลุมการเยี่ยม 90 วัน · {levelNoun || 'อำเภอ'}
                    </span>
                    <span className="text-[11px] text-[var(--fg-subtle)]">เรียงตามครอบคลุมน้อย→มาก</span>
                  </div>
                  <div className="max-h-[600px] overflow-auto">
                    {coverageScoped.length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ไม่มีข้อมูล</p>
                    ) : (
                      <ul>
                        {coverageScoped.map((r) => {
                          const prefix = !drill.amphoe ? 'อ.' : !drill.tambon ? 'ต.' : ''
                          const pctColor =
                            r.pct < 50
                              ? 'var(--risk-flood)'
                              : r.pct < 80
                              ? 'var(--risk-near)'
                              : 'var(--risk-safe)'
                          const daysLabel =
                            r.daysSince === null
                              ? 'ไม่เคยเยี่ยม'
                              : r.daysSince === 0
                              ? 'วันนี้'
                              : `${r.daysSince} วันก่อน`
                          const daysUrgent = r.daysSince === null || r.daysSince > 90
                          return (
                            <li key={r.name}>
                              <button
                                type="button"
                                onClick={() => drillInto(r.name)}
                                className="flex w-full items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[var(--bg-sunken)]"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <span className="truncate text-sm font-semibold text-[var(--fg)]">{prefix}{r.name}</span>
                                    <div className="flex shrink-0 items-center gap-3 text-xs">
                                      <span className={`font-mono font-semibold`} style={{ color: pctColor }}>
                                        {r.pct}%
                                      </span>
                                      <span className="text-[var(--fg-subtle)]">
                                        {r.visited}/{r.total} คน
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                                    <div style={{ width: `${r.pct}%`, background: pctColor }} className="h-full rounded-full transition-all" />
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                                    <span className={daysUrgent ? 'font-medium text-[var(--risk-flood)]' : 'text-[var(--fg-subtle)]'}>
                                      เยี่ยมล่าสุด: {daysLabel}
                                    </span>
                                    <span className="text-[var(--fg-subtle)]">เปราะบาง {r.total} ราย</span>
                                  </div>
                                </div>
                                <ChevronRight size={16} className="shrink-0 text-[var(--fg-subtle)]" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : activeIncidents.length === 0 && isSearching ? (
                // normal mode + searching → show people list
                <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                  {leafPeople.map((p) => {
                    const risk = (p.risk ?? 'safe') as RiskLevel
                    const isSel = selected?.id === p.id
                    return (
                      <li key={p.id}>
                        <div onClick={() => setSelected(p)} className={`flex cursor-pointer items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 transition-colors last:border-b-0 ${isSel ? 'bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'hover:bg-[var(--bg-sunken)]'}`}>
                          <span className="flex w-16 shrink-0 items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: riskColor[risk] }} />
                            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: riskColor[risk] }}>{risk === 'flood' ? 'วิกฤต' : risk === 'near' ? 'เฝ้า' : 'ปกติ'}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate text-sm font-semibold">{p.name}</span>
                              <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age}</span>
                              <span className="truncate text-xs text-[var(--fg-subtle)]">· {p.vil}</span>
                            </div>
                            <p className="truncate text-xs text-[var(--fg-muted)]">{p.cond || p.label}</p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {leafPeople.length === 0 && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ไม่พบรายการ</li>}
                </ul>
              ) : /* ── Crisis-mode: table/cards ── */
              (viewMode === 'table-risk' || viewMode === 'table-type') && !isSearching ? (
                (() => {
                  const isType = viewMode === 'table-type'
                  const rows = isType ? flatRowsByType : flatRowsByRisk
                  const cols = isType
                    ? [
                        { key: 'bedridden', label: 'ติดเตียง', tone: 'var(--risk-flood)', emph: true },
                        { key: 'disabled', label: 'พิการ', tone: 'var(--risk-flood)', emph: true },
                        { key: 'elderly', label: 'สูงอายุ', tone: 'var(--risk-near)', emph: false },
                        { key: 'pregnant', label: 'ตั้งครรภ์', tone: 'var(--risk-near)', emph: false },
                      ] as const
                    : [
                        { key: 'flood', label: 'วิกฤต', tone: 'var(--risk-flood)', emph: true },
                        { key: 'near', label: 'เฝ้าระวัง', tone: 'var(--risk-near)', emph: false },
                        { key: 'safe', label: 'ปลอดภัย', tone: 'var(--fg-subtle)', emph: false },
                      ] as const
                  const totals = cols.map((c) => rows.reduce((s, r) => s + (r as unknown as Record<string, number>)[c.key], 0))
                  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
                  return (
                    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                      <div className="max-h-[640px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-[var(--bg-sunken)] text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
                            <tr className="border-b border-[var(--border)]">
                              <th className="px-3 py-2.5 text-left">อำเภอ</th>
                              <th className="px-3 py-2.5 text-left">ตำบล</th>
                              <th className="px-3 py-2.5 text-left">หมู่บ้าน</th>
                              {cols.map((c) => (
                                <th key={c.key} className="px-3 py-2.5 text-right">{c.label}</th>
                              ))}
                              <th className="px-3 py-2.5 text-right">รวม</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => {
                              const prev = rows[idx - 1]
                              const sameAmphoe = prev?.amphoe === r.amphoe
                              const sameTambon = sameAmphoe && prev?.tambon === r.tambon
                              return (
                                <tr
                                  key={`${r.amphoe}|${r.tambon}|${r.vil}`}
                                  className="border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--bg-sunken)]"
                                >
                                  <td className={`px-3 py-2 ${sameAmphoe ? 'text-[var(--fg-subtle)]' : 'font-medium text-[var(--fg)]'}`}>
                                    {sameAmphoe ? '' : `อ.${r.amphoe}`}
                                  </td>
                                  <td className={`px-3 py-2 ${sameTambon ? 'text-[var(--fg-subtle)]' : 'text-[var(--fg)]'}`}>
                                    {sameTambon ? '' : `ต.${r.tambon}`}
                                  </td>
                                  <td className="px-3 py-2 text-[var(--fg)]">{r.vil}</td>
                                  {cols.map((c) => {
                                    const v = (r as unknown as Record<string, number>)[c.key]
                                    const has = v > 0
                                    return (
                                      <td
                                        key={c.key}
                                        className={`px-3 py-2 text-right font-mono ${has ? (c.emph ? 'font-semibold' : '') : 'text-[var(--fg-subtle)]'}`}
                                        style={has ? { color: c.tone } : undefined}
                                      >
                                        {v}
                                      </td>
                                    )
                                  })}
                                  <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--fg)]">{r.total}</td>
                                </tr>
                              )
                            })}
                            {rows.length === 0 && (
                              <tr><td colSpan={3 + cols.length + 1} className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ไม่มีข้อมูล</td></tr>
                            )}
                          </tbody>
                          {rows.length > 0 && (
                            <tfoot className="sticky bottom-0 bg-[var(--bg-sunken)] text-[12px] font-semibold">
                              <tr className="border-t-2 border-[var(--border)]">
                                <td colSpan={3} className="px-3 py-2 text-left text-[var(--fg-subtle)]">รวมในขอบเขตที่เลือก</td>
                                {cols.map((c, i) => (
                                  <td key={c.key} className="px-3 py-2 text-right font-mono" style={{ color: c.tone }}>{totals[i]}</td>
                                ))}
                                <td className="px-3 py-2 text-right font-mono text-[var(--fg)]">{grandTotal}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  )
                })()
              ) : !isSearching && drillLevel !== 'people' ? (
                <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                  {groupRows.map((g) => {
                    const pct = (n: number) => g.total ? (n / g.total) * 100 : 0
                    const prefix = drillLevel === 'amphoe' ? 'อ.' : drillLevel === 'tambon' ? 'ต.' : ''
                    return (
                      <li key={g.name}>
                        <button
                          type="button"
                          onClick={() => drillInto(g.name)}
                          className="flex w-full items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[var(--bg-sunken)]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-semibold text-[var(--fg)]">
                                {prefix}{g.name}
                              </span>
                              <span className="shrink-0 text-xs text-[var(--fg-subtle)]">
                                <span className="font-mono text-base font-semibold text-[var(--fg)]">{g.total}</span> ราย
                              </span>
                            </div>
                            {/* Stacked bar */}
                            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                              {g.flood > 0 && <div style={{ width: `${pct(g.flood)}%`, background: 'var(--risk-flood)' }} />}
                              {g.near > 0 && <div style={{ width: `${pct(g.near)}%`, background: 'var(--risk-near)' }} />}
                              {g.safe > 0 && <div style={{ width: `${pct(g.safe)}%`, background: 'var(--risk-safe)' }} />}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ background: 'var(--risk-flood)' }} />
                                <span className={g.flood > 0 ? 'font-semibold text-[var(--risk-flood)]' : 'text-[var(--fg-subtle)]'}>
                                  <span className="font-mono">{g.flood}</span> วิกฤต
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ background: 'var(--risk-near)' }} />
                                <span className={g.near > 0 ? 'text-[var(--risk-near)]' : 'text-[var(--fg-subtle)]'}>
                                  <span className="font-mono">{g.near}</span> เฝ้าระวัง
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ background: 'var(--risk-safe)' }} />
                                <span className="text-[var(--fg-subtle)]">
                                  <span className="font-mono">{g.safe}</span> ปลอดภัย
                                </span>
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="shrink-0 text-[var(--fg-subtle)]" />
                        </button>
                      </li>
                    )
                  })}
                  {groupRows.length === 0 && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ไม่มีข้อมูล</li>}
                </ul>
              ) : (
                <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                  {leafPeople.map((p) => {
                    const risk = (p.risk ?? 'safe') as RiskLevel
                    const isSel = selected?.id === p.id
                    return (
                      <li key={p.id}>
                        <div
                          onClick={() => setSelected(p)}
                          className={`flex cursor-pointer items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 transition-colors last:border-b-0 ${isSel ? 'bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'hover:bg-[var(--bg-sunken)]'}`}
                        >
                          <span className="flex w-16 shrink-0 items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: riskColor[risk] }} />
                            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: riskColor[risk] }}>{risk === 'flood' ? 'วิกฤต' : risk === 'near' ? 'เฝ้า' : 'ปกติ'}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate text-sm font-semibold text-[var(--fg)]">{p.name}</span>
                              <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age}</span>
                              {isSearching && <span className="truncate text-xs text-[var(--fg-subtle)]">· {p.vil}</span>}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="truncate text-xs text-[var(--fg-muted)]">{p.cond || p.label}</span>
                              {p.eq && (
                                <span className="shrink-0 rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--risk-flood)]">
                                  {p.eq}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'visit' })} className="gx-btn gx-btn-ghost gx-btn-sm" title="บันทึกเยี่ยม">
                              <Stethoscope size={14} />
                            </button>
                            {canCommand && (
                              <button type="button" onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'help' })} className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]" title="ขอช่วยเหลือ">
                                <LifeBuoy size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {leafPeople.length === 0 && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ไม่พบรายการ</li>}
                </ul>
              )}
            </>
          )}

          {seg === 'requests' && (
            <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              {sortedRequests.map((r) => {
                const m = priorityMeta(r.priority)
                return (
                  <li key={r.id} className="flex items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
                    <span className="flex w-16 shrink-0 items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: m.tone }} />
                      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: m.tone }}>{m.label}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-[var(--fg)]">{r.memberName}</span>
                      <p className="truncate text-xs text-[var(--fg-muted)]">{r.description || r.requestType}</p>
                    </div>
                    {canCommand && <button type="button" className="gx-btn gx-btn-ghost gx-btn-sm shrink-0"><Anchor size={14} />จัดทีม</button>}
                  </li>
                )
              })}
              {sortedRequests.length === 0 && (
                <li className="flex items-start gap-2.5 px-4 py-8 text-sm text-[var(--fg-muted)]">
                  <Activity size={16} className="mt-0.5 shrink-0 text-[var(--signal-data)]" />
                  ยังไม่มีคำร้องขอความช่วยเหลือ — คำร้องจาก อสม./ภาคสนามจะเข้ามาเรียงตามความเร่งด่วนที่นี่
                </li>
              )}
            </ul>
          )}

          {seg === 'teams' && <TeamsSegment teams={rescueTeams} canRegister={canCommand} onChange={() => router.refresh()} />}

          {seg === 'ops' && counters && incidentId && (
            <OpsPanel incidentId={incidentId} counters={counters} canCommand={canCommand} />
          )}
        </section>

        {/* SIDE — map + selected context */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-3">
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-3.5 py-2 text-xs font-medium">
                <MapPin size={14} className="text-[var(--accent)]" /> แผนที่ภูมิสารสนเทศสุขภาพ
              </div>
              <div className="h-[300px] w-full">
                <EocMap persons={seg === 'roster' ? personsScope : persons} selected={selected} onSelect={setSelected} />
              </div>
            </div>

            {selected ? (
              <div className="gx-card p-4" style={{ ['--tile' as string]: riskColor[(selected.risk ?? 'safe') as RiskLevel] }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--fg)]">{selected.name}</p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">{selected.fullAddress || `${selected.vil} · ${selected.tambon ?? ''}`}</p>
                  </div>
                  <span className="gx-badge shrink-0" style={{ ['--tone' as string]: riskColor[(selected.risk ?? 'safe') as RiskLevel] }}>
                    <span className="gx-badge-dot" />{riskLabel[(selected.risk ?? 'safe') as RiskLevel]}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
                  <div><dt className="text-[var(--fg-subtle)]">ภาวะสุขภาพ</dt><dd className="text-[var(--fg)]">{selected.cond || selected.label || '—'}</dd></div>
                  <div><dt className="text-[var(--fg-subtle)]">อุปกรณ์พยุงชีพ</dt><dd className="text-[var(--risk-flood)]">{selected.eq || '—'}</dd></div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setAction({ id: String(selected.id), name: selected.name, mode: 'visit' })} className="gx-btn gx-btn-ghost gx-btn-sm flex-1"><Stethoscope size={14} />เยี่ยม</button>
                  {canCommand && <button type="button" onClick={() => setAction({ id: String(selected.id), name: selected.name, mode: 'help' })} className="gx-btn gx-btn-primary gx-btn-sm flex-1"><LifeBuoy size={14} />ขอช่วยเหลือ</button>}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--fg-subtle)]">
                เลือกรายชื่อหรือหมุดบนแผนที่เพื่อดูรายละเอียด + สั่งการ
              </p>
            )}
          </div>
        </aside>
      </div>

      {action && (
        <FieldActionSheet
          target={{ id: action.id, name: action.name }}
          mode={action.mode}
          activeIncidents={activeIncidents}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function SegBtn({ active, onClick, count, urgent, children }: { active: boolean; onClick: () => void; count?: number; urgent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${active ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
    >
      {children}
      {count != null && (
        <span className={`rounded-full px-1.5 text-[10px] font-bold ${urgent ? 'bg-[var(--risk-flood)] text-white' : 'bg-[var(--border)] text-[var(--fg-muted)]'}`}>{count}</span>
      )}
    </button>
  )
}

function TeamsSegment({ teams, canRegister, onChange }: { teams: RescueTeam[]; canRegister: boolean; onChange: () => void }) {
  const [name, setName] = useState('')
  const [teamType, setTeamType] = useState<RescueTeamType>('rescue_boat')
  const [contact, setContact] = useState('')
  const [zone, setZone] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/rescue-teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, teamType, contact, zone }),
    }).catch(() => {})
    setSaving(false)
    setName(''); setContact(''); setZone('')
    onChange()
  }

  return (
    <div className="space-y-3">
      {canRegister && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">ขึ้นทะเบียนทีมกู้ภัย / หน่วยเคลื่อนที่เร็ว</p>
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อหน่วยงาน" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5 outline-none focus:border-[var(--accent)]" />
            <select value={teamType} onChange={(e) => setTeamType(e.target.value as RescueTeamType)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5">
              {TEAM_TYPES.map((t) => <option key={t} value={t}>{teamTypeLabel[t]}</option>)}
            </select>
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="เบอร์ติดต่อ" className="rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5 outline-none focus:border-[var(--accent)]" />
            <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="โซนรับผิดชอบ" className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] p-2.5 outline-none focus:border-[var(--accent)]" />
          </div>
          <button type="button" onClick={submit} disabled={saving} className="gx-btn gx-btn-primary gx-btn-sm mt-3 w-full">
            <Plus size={14} /> {saving ? 'กำลังบันทึก...' : 'ขึ้นทะเบียน'}
          </button>
        </div>
      )}
      <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {teams.map((t) => (
          <li key={t.id} className="flex items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0" style={{ ['--tile' as string]: 'var(--signal-data)' }}>
            <span className="gx-icon-tile size-9"><Anchor size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--fg)]">{t.name}</p>
              <p className="truncate text-xs text-[var(--fg-muted)]">{teamTypeLabel[t.teamType]} · {t.zone || 'ยังไม่กำหนดโซน'}</p>
            </div>
            <span className="gx-badge gx-badge-safe"><span className="gx-badge-dot" />{t.status === 'active' ? 'พร้อม' : t.status}</span>
          </li>
        ))}
        {teams.length === 0 && <li className="px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีทีมขึ้นทะเบียน</li>}
      </ul>
    </div>
  )
}
