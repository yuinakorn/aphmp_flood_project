'use client'

import { useMemo, useState } from 'react'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  LifeBuoy,
  Search,
  Stethoscope,
  Anchor,
  MapPin,
  Activity,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  Table as TableIcon,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Hospital,
  PhoneOff,
  ShoppingBag,
  Home,
} from 'lucide-react'
import { FieldActionSheet, type FieldActionMode } from '@/components/forms/FieldActionSheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { OpsPanel } from './OpsPanel'
import { CommandQueue } from './CommandQueue'
import { RescueTeamManager } from '@/components/rescue/RescueTeamManager'
import type { OverviewData } from '@/lib/overview'
import type {
  CoverageRow,
  DispositionSummary,
  Incident,
  IncidentCasualty,
  IncidentCounters,
  RescueTeam,
  RiskLevel,
  SurveillanceEntry,
  VulnerablePerson,
} from '@/types'

const EocFloodMap = dynamic(() => import('./EocFloodMap'), {
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
  dispositionSummary: DispositionSummary | null
  overview: OverviewData
  casualties: IncidentCasualty[]
  surveillanceEntries: SurveillanceEntry[]
  incidentId: string | null
  mapHiddenDefault: boolean
  realRole: string
}

type Segment = 'queue' | 'roster' | 'requests' | 'teams' | 'ops'

export const MAP_HIDDEN_COOKIE = 'gx-eoc-map-hidden'

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

const priorityRank = (p: string) => (p === 'critical' ? 0 : p === 'high' ? 1 : p === 'normal' ? 2 : 3)
const priorityMeta = (p: string): { tone: string; label: string } =>
  p === 'critical'
    ? { tone: 'var(--risk-flood)', label: 'วิกฤต' }
    : p === 'high'
      ? { tone: 'var(--risk-flood)', label: 'เร่งด่วน' }
      : p === 'normal'
        ? { tone: 'var(--risk-near)', label: 'เฝ้าระวัง' }
        : { tone: 'var(--risk-safe)', label: 'เตรียมแผน' }

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  medical: { label: 'การแพทย์', icon: <Stethoscope size={13} />, color: 'text-rose-600 bg-rose-50 border-rose-200/50 dark:bg-rose-950/20 dark:text-rose-400' },
  evacuation: { label: 'ขออพยพ', icon: <LifeBuoy size={13} />, color: 'text-amber-600 bg-amber-50 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400' },
  rescue: { label: 'กู้ภัย', icon: <Anchor size={13} />, color: 'text-blue-600 bg-blue-50 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400' },
  supplies: { label: 'เครื่องอุปโภคบริโภค', icon: <ShoppingBag size={13} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400' },
  shelter: { label: 'ที่พักพิง', icon: <Home size={13} />, color: 'text-indigo-600 bg-indigo-50 border-indigo-200/50 dark:bg-indigo-950/20 dark:text-indigo-400' },
  other: { label: 'อื่นๆ', icon: <Activity size={13} />, color: 'text-slate-600 bg-slate-50 border-slate-200/50 dark:bg-slate-900/50 dark:text-slate-400' },
}

const STATUS_META: Record<string, { label: string; tone: string; icon?: React.ReactNode }> = {
  new: { label: 'คำร้องใหม่', tone: '#ef4444', icon: <span className="size-1.5 rounded-full bg-red-500 animate-pulse shrink-0" /> },
  triaged: { label: 'คัดกรองแล้ว', tone: '#f59e0b', icon: <span className="size-1.5 rounded-full bg-amber-500 shrink-0" /> },
  assigned: { label: 'มอบหมายทีม', tone: '#3b82f6', icon: <span className="size-1.5 rounded-full bg-blue-500 shrink-0" /> },
  en_route: { label: 'กำลังเดินทาง', tone: '#8b5cf6', icon: <span className="size-1.5 rounded-full bg-purple-500 animate-pulse shrink-0" /> },
  resolved: { label: 'ช่วยเหลือแล้ว', tone: '#10b981', icon: <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" /> },
  cancelled: { label: 'ยกเลิก', tone: '#6b7280', icon: <span className="size-1.5 rounded-full bg-slate-500 shrink-0" /> },
}

export function EocDashboard({ persons, activeIncidents, rescueTeams, requests, coverageRows, counters, dispositionSummary, overview, casualties, surveillanceEntries, incidentId, mapHiddenDefault, realRole }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  // สิทธิ์สั่งการในแดชบอร์ด EOC — ตัดสินจาก role จริงของบัญชี (server enforce ซ้ำเสมอ)
  const canCommand = ['officer', 'ddpm', 'admin', 'eoc'].includes(realRole)

  // โหมดวิกฤต → เริ่มที่ "คิวสั่งการ" (ไปเอาใครก่อน); โหมดปกติ → "พื้นที่" (ความครอบคลุม)
  const [seg, setSeg] = useState<Segment>(activeIncidents.length === 0 ? 'roster' : 'queue')
  const [mapHidden, setMapHidden] = useState(mapHiddenDefault)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table-risk' | 'table-type'>('cards')

  // จำสถานะซ่อนแผนที่ผ่าน cookie (อ่านฝั่ง server ใน page.tsx — ไม่มี hydration mismatch)
  const toggleMap = () =>
    setMapHidden((v) => {
      const next = !v
      document.cookie = `${MAP_HIDDEN_COOKIE}=${next ? '1' : '0'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      return next
    })
  // แท็บ Sit Rep ไม่ใช้แผนที่ → กว้างเต็มเสมอ; แท็บอื่นตามปุ่มสลับ
  const showSidebar = seg !== 'ops' && seg !== 'queue' && !mapHidden
  const [search, setSearch] = useState('')
  const [drill, setDrill] = useState<{ amphoe?: string; tambon?: string; vil?: string }>({})
  const [selected, setSelected] = useState<VulnerablePerson | null>(null)
  const [action, setAction] = useState<{ id: string; name: string; mode: FieldActionMode; lifeSupport: string[] } | null>(null)
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null)
  const [resolvingRequest, setResolvingRequest] = useState<TriageRequest | null>(null)
  const [resolutionTeamId, setResolutionTeamId] = useState<string>('')
  const [resolutionCustomTeam, setResolutionCustomTeam] = useState<string>('')
  const [resolutionNotes, setResolutionNotes] = useState<string>('')

  async function handleAssignRequestTeam(requestId: string, teamId: string, teamName: string) {
    if (updatingRequestId) return
    setUpdatingRequestId(requestId)
    try {
      const res = await fetch(`/api/help-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'assigned',
          rescueTeamId: teamId,
          assignedTeam: teamName,
        }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'ไม่สามารถมอบหมายทีมได้')
      }
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการมอบหมายทีม')
    } finally {
      setUpdatingRequestId(null)
    }
  }

  async function handleUpdateRequestStatus(requestId: string, status: string) {
    if (updatingRequestId) return
    setUpdatingRequestId(requestId)
    try {
      const res = await fetch(`/api/help-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'ไม่สามารถอัปเดตสถานะได้')
      }
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ')
    } finally {
      setUpdatingRequestId(null)
    }
  }

  const counts = useMemo(() => {
    const flood = persons.filter((p) => p.risk === 'flood').length
    const near = persons.filter((p) => p.risk === 'near').length
    const safe = persons.filter((p) => p.risk === 'safe').length
    const open = requests.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled').length
    const admitted = persons.filter((p) => p.isAdmitted).length
    const unadmitted = persons.length - admitted
    return { total: persons.length, flood, near, safe, open, teams: rescueTeams.length, admitted, unadmitted }
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
  const mapPersons = seg === 'roster' ? personsScope : persons

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

  // โหมดปกติ — ribbon ความครอบคลุมการเยี่ยม (โหมดวิกฤตใช้ <DispositionFunnel> แทน)
  const ribbon = [
    { label: 'กลุ่มเปราะบาง', value: counts.total, tone: 'var(--fg)' },
    { label: 'เยี่ยมใน 90 วัน', value: totalCoverage.visited, tone: 'var(--risk-safe)' },
    { label: 'ครอบคลุม %', value: totalCoverage.pct, tone: totalCoverage.pct < 50 ? 'var(--risk-flood)' : totalCoverage.pct < 80 ? 'var(--risk-near)' : 'var(--risk-safe)' },
    { label: 'ยังไม่เคยเยี่ยม', value: totalCoverage.neverVisited, tone: totalCoverage.neverVisited > 0 ? 'var(--risk-flood)' : 'var(--fg)' },
    { label: 'หมู่บ้าน', value: coverageRows.length, tone: 'var(--signal-data)' },
  ]

  return (
    <div className="w-full -mt-4 px-4 sm:px-6">
      {/* header — กระชับแบบ /overview: ชื่อเหตุการณ์ฝังใน eyebrow, title เล็กลง */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="gx-eyebrow">ศูนย์บัญชาการ EOC{isNormalMode ? ' · โหมดปกติ' : activeIncidents[0] ? ` · ${activeIncidents[0].name}` : ' · โหมดวิกฤต'}</p>
          <h1 className="gx-title mt-0.5 text-[length:var(--text-xl)] leading-[var(--text-xl--line-height)]">ศูนย์ตอบโต้ภัยพิบัติสุขภาพ</h1>
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

      {/* โหมดวิกฤต → disposition funnel (ตอนนี้ทุกคนอยู่ไหน); โหมดปกติ → ribbon ความครอบคลุม */}
      {isNormalMode ? (
        <div className="mt-2.5 flex flex-wrap items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {ribbon.map((s, i) => (
            <div key={s.label} className={`flex flex-col px-5 py-3 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}>
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">{s.label}</span>
              <span className="font-mono text-[26px] font-semibold leading-tight" style={{ color: s.tone }}>{s.value}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 px-5 py-3 text-xs text-[var(--fg-muted)]">
            <span>ไม่มีเหตุการณ์ที่กำลังเกิด</span>
          </div>
        </div>
      ) : (
        <>
          {overview.banner.lifeSupportNotEvacuated > 0 && (
            <LifeSupportBanner n={overview.banner.lifeSupportNotEvacuated} />
          )}
          <DispositionFunnel summary={dispositionSummary} />
          <CombinedStatsStrip ribbon={overview.ribbon} casualties={counters?.casualties ?? null} />
        </>
      )}

      {isNormalMode && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--fg-muted)]">
          <Activity size={15} className="shrink-0 text-[var(--signal-data)]" />
          <span>โหมดปกติ — แสดง<span className="font-medium text-[var(--fg)]">ความครอบคลุมการเยี่ยมผู้เปราะบาง</span>รายพื้นที่ เพื่อเตรียมพร้อมรับมือ · เลือกเหตุการณ์ที่มุมขวาบนเพื่อสลับโหมดวิกฤต</span>
        </div>
      )}

      {/* working area */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* MAIN — worklist */}
        <section className={showSidebar ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-[var(--bg-sunken)] p-1 text-sm">
              {!isNormalMode && (
                <SegBtn active={seg === 'queue'} onClick={() => setSeg('queue')} count={overview.queue.length} urgent={overview.queue.length > 0}>คิวสั่งการ</SegBtn>
              )}
              <SegBtn
                active={seg === 'roster'}
                onClick={() => { setSeg('roster') }}
                count={isNormalMode ? counts.total : `${counts.unadmitted}/${counts.total}`}
                urgent={!isNormalMode && counts.unadmitted > 0}
              >
                พื้นที่
              </SegBtn>
              <SegBtn active={seg === 'requests'} onClick={() => setSeg('requests')} count={counts.open} urgent={counts.open > 0}>คำร้อง / Triage</SegBtn>
              <SegBtn active={seg === 'teams'} onClick={() => setSeg('teams')} count={counts.teams}>ทีมกู้ภัย</SegBtn>
              {counters && incidentId && (
                <SegBtn active={seg === 'ops'} onClick={() => setSeg('ops')}>ปฏิบัติการ / Sit Rep</SegBtn>
              )}
            </div>
            {seg !== 'ops' && seg !== 'queue' && (
              <div className="flex items-center gap-2">
                {seg === 'roster' && activeIncidents.length > 0 && (
                  <>
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
                  </>
                )}
                <button
                  type="button"
                  onClick={toggleMap}
                  title={mapHidden ? 'แสดงแผนที่' : 'ซ่อนแผนที่เพื่อขยายพื้นที่ทำงาน'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
                >
                  {mapHidden ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                  {mapHidden ? 'แสดงแผนที่' : 'ซ่อนแผนที่'}
                </button>
              </div>
            )}
            {seg === 'queue' && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
                <span className="font-semibold text-[var(--fg-subtle)]">ระดับความเร่งด่วน:</span>
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--risk-flood)]" />P1 วิกฤต — ถึงชีวิตทันที</span>
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--risk-near)]" />P2 เร่งด่วน — รีบช่วย</span>
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--risk-safe)]" />P3 เฝ้าระวัง — ติดตามอาการ</span>
              </div>
            )}
          </div>

          {seg === 'queue' && <CommandQueue data={overview} rescueTeams={rescueTeams} />}

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
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--fg-subtle)]">
                      ความครอบคลุมการเยี่ยม 90 วัน · {levelNoun || 'อำเภอ'}
                    </span>
                    <span className="text-xs text-[var(--fg-subtle)] font-medium">เรียงตามครอบคลุมน้อย→มาก</span>
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
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: riskColor[risk] }}>{risk === 'flood' ? 'วิกฤต' : risk === 'near' ? 'เฝ้า' : 'ปกติ'}</span>
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
                          <thead className="sticky top-0 z-10 bg-[var(--bg-sunken)] text-xs font-bold uppercase tracking-wide text-[var(--fg-subtle)]">
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
                            <tfoot className="sticky bottom-0 bg-[var(--bg-sunken)] text-xs font-bold">
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
                    const isAdmitted = p.isAdmitted
                    return (
                      <li key={p.id}>
                        <div
                          onClick={() => setSelected(p)}
                          className={`flex cursor-pointer items-center gap-3.5 border-b border-[var(--border)] px-4 py-3 transition-colors last:border-b-0 ${isSel ? 'bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]' : 'hover:bg-[var(--bg-sunken)]'} ${isAdmitted ? 'opacity-75 bg-[color-mix(in_oklch,var(--risk-safe)_4%,transparent)]' : ''}`}
                        >
                          <span className="flex w-16 shrink-0 items-center gap-2">
                            {isAdmitted ? (
                              <>
                                <span className="size-2.5 shrink-0 rounded-full bg-[var(--risk-safe)]" />
                                <span className="text-xs font-bold uppercase tracking-wide text-[var(--risk-safe)]">ในศูนย์</span>
                              </>
                            ) : (
                              <>
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: riskColor[risk] }} />
                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: riskColor[risk] }}>{risk === 'flood' ? 'วิกฤต' : risk === 'near' ? 'เฝ้า' : 'ปกติ'}</span>
                              </>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate text-sm font-semibold text-[var(--fg)]">{p.name}</span>
                              <span className="font-mono text-xs text-[var(--fg-subtle)]">{p.age}</span>
                              {isSearching && <span className="truncate text-xs text-[var(--fg-subtle)]">· {p.vil}</span>}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="truncate text-xs text-[var(--fg-muted)]">
                                {p.cond || p.label}
                                {isAdmitted && p.shelterName && (
                                  <span className="ml-1.5 font-medium text-[var(--risk-safe)]">
                                    · พักที่ {p.shelterName}
                                  </span>
                                )}
                              </span>
                              {p.eq && (
                                <span className="shrink-0 rounded bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--risk-flood)]">
                                  {p.eq}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'visit', lifeSupport: p.lifeSupport ?? [] })} className="gx-btn gx-btn-ghost gx-btn-sm" title="บันทึกเยี่ยม">
                              <Stethoscope size={14} />
                            </button>
                            {canCommand && (
                              <button type="button" onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'help', lifeSupport: p.lifeSupport ?? [] })} className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]" title="ขอช่วยเหลือ">
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
            <div className="space-y-3">
              {sortedRequests.map((r) => {
                const typeMeta = TYPE_META[r.requestType] || TYPE_META.other
                const statusMeta = STATUS_META[r.status] || { label: r.status, tone: '#6b7280' }
                const priorityM = priorityMeta(r.priority)
                const formattedTime = r.observedAt
                  ? new Date(r.observedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
                  : ''
                const formattedDate = r.observedAt
                  ? new Date(r.observedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                  : ''

                return (
                  <div
                    key={r.id}
                    className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-white dark:bg-slate-950 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[color-mix(in_oklch,var(--accent)_30%,var(--border))]"
                  >
                    {/* Top row: Priority badge + Status + Time */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {/* Priority Badge */}
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border"
                          style={{
                            borderColor: `color-mix(in oklch, ${priorityM.tone} 30%, transparent)`,
                            backgroundColor: `color-mix(in oklch, ${priorityM.tone} 8%, transparent)`,
                            color: priorityM.tone
                          }}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: priorityM.tone }} />
                          {priorityM.label}
                        </span>

                        {/* Request Type Badge */}
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${typeMeta.color}`}>
                          {typeMeta.icon}
                          {typeMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--fg-muted)] font-mono">
                          {formattedDate} {formattedTime}
                        </span>
                        
                        {/* Status indicator */}
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium border"
                          style={{
                            borderColor: `color-mix(in oklch, ${statusMeta.tone} 30%, transparent)`,
                            backgroundColor: `color-mix(in oklch, ${statusMeta.tone} 8%, transparent)`,
                            color: statusMeta.tone
                          }}
                        >
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Patient Name + Description */}
                    <div className="mb-3.5">
                      <h4 className="text-[14px] font-bold text-[var(--fg)] mb-1">
                        {r.memberName}
                      </h4>
                      <p className="text-[12.5px] text-[var(--fg-muted)] leading-relaxed">
                        {r.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                      </p>
                    </div>

                    {/* Bottom: Action row */}
                    {canCommand && (
                      <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3 mt-1">
                        {/* Assign Team Dropdown */}
                        {!(r.status === 'assigned' || r.status === 'en_route' || r.status === 'resolved' || r.description?.includes('มอบหมาย') || r.description?.includes('คิวสั่งการ') || r.description?.includes('จัดสรร')) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="xs"
                                  disabled={updatingRequestId === r.id}
                                  className="h-8 gap-1.5 text-xs border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-900"
                                >
                                  <Anchor size={13} className="text-blue-500" />
                                  มอบหมายทีม
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-950 border border-[var(--border)] shadow-lg rounded-md p-1">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[11px] text-slate-500 px-2 py-1">
                                  เลือกทีมกู้ชีพกู้ภัยที่สแตนด์บาย
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="my-1 border-t border-[var(--border)]" />
                                {rescueTeams
                                  .filter((t) => t.status !== 'offline')
                                  .map((team) => (
                                    <DropdownMenuItem
                                      key={team.id}
                                      onClick={() => handleAssignRequestTeam(r.id, team.id, team.name)}
                                      className="cursor-pointer text-xs flex items-center justify-between px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded"
                                    >
                                      <span>{team.name}</span>
                                      <span className="text-[10px] text-[var(--fg-subtle)] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded group-focus/dropdown-menu-item:bg-white/20 group-focus/dropdown-menu-item:text-white">
                                        {team.zone || 'ทุกพื้นที่'}
                                      </span>
                                    </DropdownMenuItem>
                                  ))}
                                {rescueTeams.filter((t) => t.status !== 'offline').length === 0 && (
                                  <DropdownMenuItem disabled className="text-xs text-slate-400 px-2 py-1.5">
                                    ไม่มีทีมกู้ภัยออนไลน์ในขณะนี้
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {/* Status Transition buttons: Resolve and Cancel */}
                        {r.status !== 'resolved' && (
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={updatingRequestId === r.id}
                            onClick={() => {
                              setResolvingRequest(r)
                              setResolutionTeamId('')
                              setResolutionCustomTeam('')
                              setResolutionNotes('')
                            }}
                            className="h-8 gap-1 text-xs border-emerald-200 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            <CheckCircle2 size={13} />
                            เสร็จสิ้น
                          </Button>
                        )}

                        {r.status !== 'cancelled' && (
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={updatingRequestId === r.id}
                            onClick={() => handleUpdateRequestStatus(r.id, 'cancelled')}
                            className="h-8 gap-1 text-xs border-rose-200 bg-rose-50/30 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            <PhoneOff size={13} />
                            ยกเลิกคำขอ
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {sortedRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-slate-500">
                  <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 p-3 mb-3 text-emerald-500">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-[var(--fg)] mb-1">ไม่มีคำร้องค้างคาในคิว</h4>
                  <p className="text-xs text-[var(--fg-muted)] max-w-sm">
                    คำร้องขอความช่วยเหลือจาก อสม. หรือฟอร์มรายงานสาธารณะที่ได้รับการอนุมัติ จะมาเรียงความสำคัญเพื่อสั่งการช่วยเหลือที่นี่
                  </p>
                </div>
              )}
            </div>
          )}

          {seg === 'teams' && <RescueTeamManager teams={rescueTeams} canManage={canCommand} mode="dispatch" onChange={() => router.refresh()} />}

          {seg === 'ops' && counters && incidentId && (
            <OpsPanel
              incidentId={incidentId}
              counters={counters}
              casualties={casualties}
              surveillanceEntries={surveillanceEntries}
              canCommand={canCommand}
            />
          )}
        </section>

        {/* SIDE — map + selected context */}
        {showSidebar && (
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-3">
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-3.5 py-2 text-xs font-medium">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin size={14} className="shrink-0 text-[var(--accent)]" />
                  <span className="truncate">แผนที่ภูมิสารสนเทศสุขภาพ</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setMapExpanded(true)}
                  title="ขยายแผนที่"
                  className="shrink-0 border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] font-medium"
                >
                  <Maximize2 size={13} />
                  ขยายแผนที่
                </Button>
              </div>
              <div className="h-[300px] w-full">
                <EocFloodMap sessionRole={realRole} activeIncidents={activeIncidents} />
              </div>
            </div>

            <SelectedPersonContext
              selected={selected}
              canCommand={canCommand}
              onAction={(nextAction) => setAction(nextAction)}
            />
          </div>
        </aside>
        )}
      </div>

      {action && (
        <FieldActionSheet
          target={{ id: action.id, name: action.name }}
          mode={action.mode}
          currentLifeSupport={action.lifeSupport}
          activeIncidents={activeIncidents}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); router.refresh() }}
        />
      )}

      <Sheet open={!!resolvingRequest} onOpenChange={(o) => { if (!o) setResolvingRequest(null) }}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className="w-full gap-0 sm:max-w-md bg-white dark:bg-slate-950 border-l border-[var(--border)] p-0 flex flex-col">
          <SheetHeader className="border-b border-[var(--border)] px-4 py-3 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-sm text-[var(--fg)]">
              <CheckCircle2 size={16} className="text-emerald-500" />
              บันทึกการเสร็จสิ้นภารกิจ
            </SheetTitle>
            <SheetDescription className="text-xs text-[var(--fg-muted)]">
              ระบุทีมที่เข้าช่วยเหลือและข้อมูลผลการดำเนินงานสำหรับเคส {resolvingRequest?.memberName}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Rescue Team Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--fg-subtle)]">ทีมกู้ชีพกู้ภัยที่สแตนด์บาย</label>
              <select
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white dark:bg-slate-950 px-3 text-[13px] outline-none focus:border-[var(--accent)] text-[var(--fg)]"
                value={resolutionTeamId}
                onChange={(e) => {
                  setResolutionTeamId(e.target.value)
                  if (e.target.value) setResolutionCustomTeam('')
                }}
              >
                <option value="">-- ไม่ระบุทีมกู้ภัย --</option>
                {rescueTeams
                  .filter((t) => t.status !== 'offline')
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.zone ? `(${team.zone})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Or Custom External Team */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--fg-subtle)]">ระบุทีมอื่น ๆ (กรณีทีมนอกระบบ/ EMS)</label>
              <input
                type="text"
                placeholder="เช่น ทีมกู้ชีพ อบต.พังงา, EMS รพ."
                className="h-9 w-full rounded-md border border-[var(--border)] bg-white dark:bg-slate-950 px-3 text-[13px] outline-none focus:border-[var(--accent)] text-[var(--fg)]"
                value={resolutionCustomTeam}
                onChange={(e) => {
                  setResolutionCustomTeam(e.target.value)
                  if (e.target.value) setResolutionTeamId('')
                }}
              />
            </div>

            {/* Resolution Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--fg-subtle)]">บันทึกผลการช่วยเหลือ / หมายเหตุการเสร็จสิ้น</label>
              <textarea
                rows={3}
                placeholder="ระบุรายละเอียด เช่น อพยพออกมาพักที่ศูนย์โรงเรียนเรียบร้อย ปลอดภัยดี"
                className="w-full rounded-md border border-[var(--border)] bg-white dark:bg-slate-950 p-2.5 text-[13px] outline-none focus:border-[var(--accent)] text-[var(--fg)]"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4 shrink-0">
            <Button
              variant="outline"
              onClick={() => setResolvingRequest(null)}
              disabled={updatingRequestId !== null}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={async () => {
                if (!resolvingRequest) return
                setUpdatingRequestId(resolvingRequest.id)
                try {
                  const selectedTeam = rescueTeams.find(t => t.id === resolutionTeamId)
                  const res = await fetch(`/api/help-requests/${resolvingRequest.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: 'resolved',
                      rescueTeamId: resolutionTeamId || undefined,
                      assignedTeam: resolutionCustomTeam || (selectedTeam ? selectedTeam.name : undefined),
                      notes: resolutionNotes.trim() || undefined,
                    }),
                  })
                  if (res.ok) {
                    setResolvingRequest(null)
                    router.refresh()
                  } else {
                    const json = await res.json().catch(() => ({}))
                    alert(json.error || 'ไม่สามารถบันทึกเสร็จสิ้นได้')
                  }
                } catch (e) {
                  console.error(e)
                  alert('เกิดข้อผิดพลาดในการบันทึก')
                } finally {
                  setUpdatingRequestId(null)
                }
              }}
              disabled={updatingRequestId !== null}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {updatingRequestId ? 'กำลังบันทึก...' : 'เสร็จสิ้นภารกิจ'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={mapExpanded} onOpenChange={setMapExpanded}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className="!inset-2 !h-auto !w-auto !max-w-none gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-0 sm:!inset-4"
        >
          <SheetHeader className="border-b border-[var(--border)] px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-[var(--accent)]" />
              แผนที่ภูมิสารสนเทศสุขภาพ
            </SheetTitle>
            <SheetDescription className="text-xs">
              {mapPersons.length.toLocaleString('th-TH')} รายในขอบเขตที่แสดง
              {selected ? ` · เลือก: ${selected.name}` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-[48dvh] min-h-[360px] w-full lg:h-auto">
              <EocFloodMap sessionRole={realRole} activeIncidents={activeIncidents} />
            </div>
            <aside className="min-h-0 border-t border-[var(--border)] bg-[var(--bg)] p-4 lg:border-l lg:border-t-0">
              <div className="lg:sticky lg:top-4">
                <SelectedPersonContext
                  selected={selected}
                  canCommand={canCommand}
                  onAction={(nextAction) => setAction(nextAction)}
                />
              </div>
            </aside>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Disposition funnel (โหมดวิกฤต) — "คนทั้งหมดตอนนี้อยู่ไหน" ──
// นิยาม/สี/precedence: docs/new/EOC-KPI-DISPOSITION-SPEC.md §2-§3
function DispositionFunnel({
  summary,
}: {
  summary: DispositionSummary | null
}) {
  const s = summary ?? { total: 0, safe: 0, atHome: 0, inTransit: 0, referred: 0, unreachable: 0 }
  const pct = s.total > 0 ? Math.round((s.safe / s.total) * 100) : 0

  const cards: {
    key: string
    label: string
    value: number
    tone: string
    icon: React.ReactNode
    caption: string
    urgent?: boolean
  }[] = [
    { key: 'total', label: 'ทั้งหมด', value: s.total, tone: 'var(--fg)', icon: <Users size={14} />, caption: 'ในเหตุการณ์นี้' },
    { key: 'safe', label: 'ปลอดภัย / อพยพแล้ว', value: s.safe, tone: 'var(--risk-safe)', icon: <CheckCircle2 size={14} />, caption: `${pct}% ของทั้งหมด` },
    { key: 'at_home', label: 'ยังอยู่ในบ้าน', value: s.atHome, tone: 'var(--risk-flood)', icon: <AlertTriangle size={14} />, caption: 'ยืนยันแล้ว — ต้องช่วย' },
    { key: 'in_transit', label: 'กำลังเคลื่อนย้าย', value: s.inTransit, tone: 'var(--risk-near)', icon: <ArrowRight size={14} />, caption: 'ติดตามให้ถึงปลายทาง' },
    { key: 'referred', label: 'ส่งต่อ รพ.', value: s.referred, tone: 'var(--signal-data)', icon: <Hospital size={14} />, caption: 'ติดตามกับ รพ.ปลายทาง' },
    { key: 'unreachable', label: 'ติดต่อไม่ได้', value: s.unreachable, tone: 'var(--fg)', icon: <PhoneOff size={14} />, caption: 'ต้องส่งทีมเข้าพื้นที่', urgent: true },
  ]

  return (
    <div className="mt-2">
      {/* header ── */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2 px-0.5 text-xs text-[var(--fg-muted)]">
        <span className="font-bold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">การกระจายตัวของคน</span>
        <span className="ml-auto font-medium">ตอนนี้ทุกคนอยู่ไหน · รวม {s.total} ราย</span>
      </div>

      {/* funnel cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const emphasized = c.urgent && c.value > 0
          return (
            <div
              key={c.key}
              className="flex flex-col gap-1 rounded-xl border px-3 py-2.5"
              style={
                emphasized
                  ? {
                      background: 'color-mix(in oklch, var(--risk-flood) 10%, var(--bg-elevated))',
                      borderColor: 'color-mix(in oklch, var(--risk-flood) 30%, var(--border))',
                      borderTop: '2.5px solid var(--risk-flood)',
                    }
                  : { background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderTop: `2.5px solid ${c.tone}` }
              }
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase tracking-[0.06em]"
                  style={{ color: emphasized ? 'var(--risk-flood)' : 'var(--fg-subtle)' }}
                >
                  {c.label}
                </span>
                <span style={{ color: emphasized ? 'var(--risk-flood)' : c.tone }}>{c.icon}</span>
              </div>
              <span
                className="font-mono text-[24px] font-bold leading-none my-0.5"
                style={{ color: emphasized ? 'var(--fg)' : c.tone }}
              >
                {c.value}
              </span>
              <span
                className="text-xs leading-tight font-medium text-slate-550 dark:text-slate-400"
              >
                {c.caption}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// แบนเนอร์เตือนเคสวิกฤตที่สุด (พึ่งอุปกรณ์พยุงชีพ + อยู่ในเขตน้ำท่วม + ยังไม่อพยพ) ──
function LifeSupportBanner({ n }: { n: number }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-[11px] border border-[color-mix(in_oklch,var(--risk-flood)_28%,transparent)] bg-[color-mix(in_oklch,var(--risk-flood)_8%,var(--bg-elevated))] px-3.5 py-2 shadow-xs">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--risk-flood)] text-white">
        <AlertTriangle className="size-[16px]" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <b className="block text-[14px] font-bold leading-snug text-[var(--risk-flood)]">
          ผู้ป่วยพึ่งอุปกรณ์พยุงชีพในเขตน้ำท่วม ยังไม่อพยพ <span className="font-mono text-[16px]">{n}</span> ราย
        </b>
        <span className="text-xs text-[var(--fg-muted)] font-medium">ออกซิเจน/ฟอกไต · อยู่ในเขตน้ำท่วม · ยังไม่มีทีมเข้ารับ</span>
      </div>
    </div>
  )
}

// แถบควบรวมความสูญเสียและบริบทพื้นที่ เพื่อความกะทัดรัดแนวตั้ง (Unified Context & Casualty Bar)
function CombinedStatsStrip({
  ribbon,
  casualties,
}: {
  ribbon: OverviewData['ribbon']
  casualties: IncidentCounters['casualties'] | null
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">บริบทพื้นที่:</span>
        <CasualtyStat label="ในเขตน้ำท่วม" value={ribbon.inFlood} tone="var(--risk-flood)" />
        <span className="flex items-center gap-1.5">
          <span className="text-[var(--fg-muted)]">พึ่งอุปกรณ์ช่วยชีพ:</span>
          <span className="font-mono font-semibold" style={{ color: ribbon.lifeSupport > 0 ? 'var(--risk-flood)' : 'var(--fg)' }}>{ribbon.lifeSupport}</span>
          <span className="text-[var(--fg-subtle)]">(O2 {ribbon.lifeSupportBreak.oxygen} · ฟอกไต {ribbon.lifeSupportBreak.dialysis})</span>
        </span>
        <CasualtyStat label="ทีมพร้อม" value={ribbon.teams} tone="var(--signal-data)" />
      </div>
      {casualties && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:border-l sm:border-[var(--border)] sm:pl-4">
          <span className="font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">สูญเสีย:</span>
          <CasualtyStat label="เสียชีวิต" value={casualties.dead} tone="var(--risk-flood)" />
          <CasualtyStat label="บาดเจ็บ" value={casualties.injured} tone="var(--risk-near)" />
          <CasualtyStat label="สูญหาย" value={casualties.missing} tone="var(--risk-flood)" />
          <CasualtyStat label="เจ็บป่วย" value={casualties.ill} tone="var(--signal-data)" />
        </div>
      )}
    </div>
  )
}

function CasualtyStat({ label, value, tone }: { label: string; value: number | null | undefined; tone: string }) {
  const v = Number.isFinite(value) ? (value as number) : 0
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="font-mono font-semibold" style={{ color: v > 0 ? tone : 'var(--fg)' }}>{v}</span>
    </span>
  )
}

function SegBtn({ active, onClick, count, urgent, children }: { active: boolean; onClick: () => void; count?: number | string; urgent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${active ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
    >
      {children}
      {count != null && (
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${urgent ? 'bg-[var(--risk-flood)] text-white' : 'bg-[var(--border)] text-[var(--fg-muted)]'}`}>{count}</span>
      )}
    </button>
  )
}

function SelectedPersonContext({
  selected,
  canCommand,
  onAction,
}: {
  selected: VulnerablePerson | null
  canCommand: boolean
  onAction: (action: { id: string; name: string; mode: FieldActionMode; lifeSupport: string[] }) => void
}) {
  if (!selected) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--fg-subtle)]">
        เลือกรายชื่อหรือหมุดบนแผนที่เพื่อดูรายละเอียด + สั่งการ
      </p>
    )
  }

  const risk = (selected.risk ?? 'safe') as RiskLevel

  return (
    <div className="gx-card p-4" style={{ ['--tile' as string]: riskColor[risk] }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--fg)]">{selected.name}</p>
          <p className="truncate text-xs text-[var(--fg-muted)]">{selected.fullAddress || `${selected.vil} · ${selected.tambon ?? ''}`}</p>
        </div>
        <span className="gx-badge shrink-0" style={{ ['--tone' as string]: riskColor[risk] }}>
          <span className="gx-badge-dot" />{riskLabel[risk]}
        </span>
      </div>
      <dl className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
        <div><dt className="text-[var(--fg-subtle)]">ภาวะสุขภาพ</dt><dd className="text-[var(--fg)]">{selected.cond || selected.label || '—'}</dd></div>
        <div><dt className="text-[var(--fg-subtle)]">อุปกรณ์พยุงชีพ</dt><dd className="text-[var(--risk-flood)]">{selected.eq || '—'}</dd></div>
      </dl>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onAction({ id: String(selected.id), name: selected.name, mode: 'visit', lifeSupport: selected.lifeSupport ?? [] })} className="gx-btn gx-btn-ghost gx-btn-sm flex-1"><Stethoscope size={14} />เยี่ยม</button>
        {canCommand && <button type="button" onClick={() => onAction({ id: String(selected.id), name: selected.name, mode: 'help', lifeSupport: selected.lifeSupport ?? [] })} className="gx-btn gx-btn-primary gx-btn-sm flex-1"><LifeBuoy size={14} />ขอช่วยเหลือ</button>}
      </div>
    </div>
  )
}
