'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, BedDouble, UserRound, Accessibility, Baby, HelpCircle, Waves, AlertTriangle, ShieldCheck, LayoutList, BarChart3, Sparkles, Clock3, Trash2, Loader2 } from 'lucide-react'
import { VulnerableWorklist, VulnerableLegacyTable } from './VulnerableTable'
import { VulnerabilitySummaryTable } from './VulnerabilitySummaryTable'
import { EditVulnerableSheet } from '@/components/forms/EditVulnerableSheet'
import { VulnerableDetailSheet } from '@/components/panels/VulnerableDetailSheet'
import { FLOOD_CENTROID } from '@/lib/flood-area'
import type { Incident, RiskLevel, VulnerablePerson, VulnerableType } from '@/types'

type RiskFilter = RiskLevel | 'all'
type TypeFilter = VulnerableType | 'all'
type DisplayMode = 'new' | 'legacy'
type LegacyView = 'summary' | 'detail'

interface Props {
  persons: VulnerablePerson[]
  canEdit: boolean
  activeIncidents: Incident[]
  addButton?: React.ReactNode
  isNational?: boolean
  userProvince?: string | null
}

const RISK_ORDER: Record<RiskLevel, number> = { flood: 0, near: 1, safe: 2 }

const TYPE_META: { key: VulnerableType; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { key: 'bedridden', label: 'ติดเตียง', Icon: BedDouble },
  { key: 'elderly',   label: 'สูงอายุ',  Icon: UserRound },
  { key: 'disabled',  label: 'พิการ',     Icon: Accessibility },
  { key: 'pregnant',  label: 'ตั้งครรภ์', Icon: Baby },
  { key: 'other',     label: 'อื่นๆ',     Icon: HelpCircle },
]

export function VulnerableClientView({ persons, canEdit, activeIncidents, addButton, isNational = false, userProvince = null }: Props) {
  const router = useRouter()
  const [displayMode, setDisplayMode] = useState<DisplayMode>('new')
  const [legacyView, setLegacyView]   = useState<LegacyView>('summary')
  const [search, setSearch]           = useState('')
  const [riskFilter, setRiskFilter]   = useState<RiskFilter>('all')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all')
  const [viewId, setViewId]           = useState<string | null>(null)
  const [editId, setEditId]           = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const stats = useMemo(() => ({
    flood:     persons.filter(p => p.risk === 'flood').length,
    near:      persons.filter(p => p.risk === 'near').length,
    safe:      persons.filter(p => !p.risk || p.risk === 'safe').length,
    bedridden: persons.filter(p => p.type === 'bedridden').length,
    elderly:   persons.filter(p => p.type === 'elderly').length,
    disabled:  persons.filter(p => p.type === 'disabled').length,
    pregnant:  persons.filter(p => p.type === 'pregnant').length,
    other:     persons.filter(p => p.type === 'other').length,
  }), [persons])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return persons
      .filter(p => {
        if (riskFilter !== 'all' && (p.risk ?? 'safe') !== riskFilter) return false
        if (typeFilter !== 'all' && p.type !== typeFilter) return false
        if (q) {
          const haystack = [p.name, p.vil, p.tambon, p.amphoe, p.cond, p.label].join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (RISK_ORDER[a.risk ?? 'safe'] ?? 2) - (RISK_ORDER[b.risk ?? 'safe'] ?? 2))
  }, [persons, search, riskFilter, typeFilter])

  const hasActiveFilter = riskFilter !== 'all' || typeFilter !== 'all' || search.trim() !== ''

  function clearFilters() {
    setSearch('')
    setRiskFilter('all')
    setTypeFilter('all')
  }

  function handleView(p: VulnerablePerson) {
    setViewId(String(p.id))
  }

  function handleEdit(p: VulnerablePerson) {
    setEditId(String(p.id))
  }

  function handleDeleteRequest(p: VulnerablePerson) {
    setDeleteError(null)
    setDeleteTarget({ id: String(p.id), name: p.name })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/vulnerable/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'ลบไม่สำเร็จ')
      setDeleteTarget(null)
      router.refresh()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Mode toggle ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-sunken)] p-0.5">
          <button
            type="button"
            onClick={() => setDisplayMode('new')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-all ${
              displayMode === 'new'
                ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm'
                : 'text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]'
            }`}
          >
            <Sparkles size={11} strokeWidth={2} />
            มุมมองใหม่
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('legacy')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-all ${
              displayMode === 'legacy'
                ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm'
                : 'text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]'
            }`}
          >
            <Clock3 size={11} strokeWidth={2} />
            มุมมองเดิม
          </button>
        </div>
        {addButton}
      </div>

      {/* ── Legacy mode ── */}
      {displayMode === 'legacy' && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLegacyView('summary')}
              className={`gx-btn gx-btn-sm ${legacyView === 'summary'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]'
                : 'gx-btn-ghost'
              }`}
            >
              <BarChart3 size={14} strokeWidth={1.75} />
              สรุปตาราง
            </button>
            <button
              type="button"
              onClick={() => setLegacyView('detail')}
              className={`gx-btn gx-btn-sm ${legacyView === 'detail'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]'
                : 'gx-btn-ghost'
              }`}
            >
              <LayoutList size={14} strokeWidth={1.75} />
              รายบุคคล
            </button>
          </div>

          {legacyView === 'summary'
            ? <VulnerabilitySummaryTable persons={persons} />
            : <VulnerableLegacyTable persons={persons} canEdit={canEdit} activeIncidents={activeIncidents} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteRequest} />
          }
        </div>
      )}

      {/* ── New mode ── */}
      {displayMode === 'new' && <>

      {/* ── Stat ribbon ── */}
      <div className="gx-card overflow-hidden p-0">
        <div className="flex items-stretch divide-x divide-[var(--border)]">

          {/* Total */}
          <div className="flex min-w-[80px] flex-col items-start justify-center gap-0.5 px-5 py-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--fg-subtle)]">ทั้งหมด</span>
            <span className="font-mono text-[22px] font-semibold leading-none text-[var(--fg)]">{persons.length}</span>
          </div>

          {/* Risk stats */}
          <RiskChip
            label="ในน้ำ"
            count={stats.flood}
            color="var(--risk-flood)"
            active={riskFilter === 'flood'}
            onClick={() => setRiskFilter(f => f === 'flood' ? 'all' : 'flood')}
            Icon={Waves}
          />
          <RiskChip
            label="ใกล้เขต"
            count={stats.near}
            color="var(--risk-near)"
            active={riskFilter === 'near'}
            onClick={() => setRiskFilter(f => f === 'near' ? 'all' : 'near')}
            Icon={AlertTriangle}
          />
          <RiskChip
            label="ปลอดภัย"
            count={stats.safe}
            color="var(--risk-safe)"
            active={riskFilter === 'safe'}
            onClick={() => setRiskFilter(f => f === 'safe' ? 'all' : 'safe')}
            Icon={ShieldCheck}
          />

          {/* Divider spacer */}
          <div className="flex-1" />

          {/* Type filters */}
          {TYPE_META.map(({ key, label, Icon }) => (
            <TypeChip
              key={key}
              label={label}
              count={stats[key]}
              Icon={Icon}
              active={typeFilter === key}
              onClick={() => setTypeFilter(f => f === key ? 'all' : key)}
            />
          ))}
        </div>
      </div>

      {/* ── Search + clear ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ หมู่บ้าน ตำบล หรืออาการ..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-sunken)] py-2 pl-9 pr-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--accent)_15%,transparent)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--fg-subtle)] hover:text-[var(--fg)]"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="gx-btn gx-btn-ghost gx-btn-sm shrink-0"
          >
            <X size={13} strokeWidth={2} />
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* ── Result summary ── */}
      {hasActiveFilter && (
        <p className="text-[13px] text-[var(--fg-subtle)]">
          แสดง{' '}
          <span className="font-mono font-semibold text-[var(--fg)]">{filtered.length}</span>
          {' '}จาก{' '}
          <span className="font-mono">{persons.length}</span> ราย
        </p>
      )}

      {/* ── Worklist ── */}
      <VulnerableWorklist
        persons={filtered}
        canEdit={canEdit}
        activeIncidents={activeIncidents}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      </>}

      {/* ── Detail sheet ── */}
      <VulnerableDetailSheet
        personId={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onEdit={viewId ? () => { setEditId(viewId); setViewId(null) } : undefined}
        canEdit={canEdit}
        activeIncidents={activeIncidents}
      />

      {/* ── Edit sheet ── */}
      {editId && (
        <EditVulnerableSheet
          personId={editId}
          open={!!editId}
          onClose={() => setEditId(null)}
          onDone={() => { setEditId(null); router.refresh() }}
          isNational={isNational}
          userProvince={userProvince}
          defaultCenter={FLOOD_CENTROID}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => { if (!deleting) setDeleteTarget(null) }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--risk-flood)_12%,transparent)]">
              <Trash2 size={18} className="text-[var(--risk-flood)]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--fg)]">ยืนยันการลบ</h3>
            <p className="mt-1.5 text-[13px] text-[var(--fg-muted)]">
              ลบ <span className="font-semibold text-[var(--fg)]">{deleteTarget.name}</span>{' '}
              ออกจากทะเบียน? การลบจะถูกบันทึก audit log
            </p>
            {deleteError && (
              <p className="mt-2 text-[12px] text-[var(--risk-flood)]">{deleteError}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="gx-btn gx-btn-ghost flex-1"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="gx-btn flex-1 border-[var(--risk-flood)] bg-[var(--risk-flood)] text-white hover:opacity-90 disabled:opacity-60"
              >
                {deleting
                  ? <><Loader2 size={14} className="animate-spin" /> กำลังลบ…</>
                  : <><Trash2 size={14} /> ลบออกจากทะเบียน</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/* ── Sub-components ── */

function RiskChip({
  label, count, color, active, onClick, Icon,
}: {
  label: string
  count: number
  color: string
  active: boolean
  onClick: () => void
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[96px] flex-col items-start gap-0.5 px-5 py-3.5 transition-colors hover:bg-[var(--bg-sunken)]"
      style={active ? { background: `color-mix(in oklch, ${color} 9%, transparent)` } : undefined}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        <Icon size={13} strokeWidth={1.75} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em]">{label}</span>
        {active && (
          <span
            className="ml-0.5 size-1.5 rounded-full"
            style={{ background: color }}
          />
        )}
      </div>
      <span className="font-mono text-[22px] font-semibold leading-none" style={{ color }}>
        {count}
      </span>
    </button>
  )
}

function TypeChip({
  label, count, Icon, active, onClick,
}: {
  label: string
  count: number
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-4 py-3 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg)]"
      style={active ? {
        background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
        color: 'var(--accent)',
      } : undefined}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span className="text-[10.5px] font-medium leading-none">{label}</span>
      <span className="font-mono text-[13px] font-semibold leading-none">{count}</span>
    </button>
  )
}
