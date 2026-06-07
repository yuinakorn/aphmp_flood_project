'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stethoscope, LifeBuoy, Waves, AlertTriangle, ShieldCheck, Zap } from 'lucide-react'
import { FieldActionSheet, type FieldActionMode } from '@/components/forms/FieldActionSheet'
import type { Incident, RiskLevel, VulnerablePerson, VulnerableType } from '@/types'

// ─── Legacy (classic) table ──────────────────────────────────────────────────

const legacyTypeColor: Record<string, string> = {
  bedridden: 'var(--risk-flood)',
  elderly:   'var(--risk-near)',
  disabled:  'oklch(0.62 0.18 305)',
  pregnant:  'oklch(0.72 0.14 350)',
  other:     'var(--fg-subtle)',
}

const legacyRiskLabel: Record<RiskLevel, string> = { flood: 'ในน้ำ', near: 'ใกล้เขต', safe: 'ปลอดภัย' }
const legacyRiskBadge: Record<RiskLevel, string> = {
  flood: 'gx-badge gx-badge-flood',
  near:  'gx-badge gx-badge-near',
  safe:  'gx-badge gx-badge-safe',
}

function groupByArea(persons: VulnerablePerson[]) {
  const map = new Map<string, { amphoe: string; tambon: string; persons: VulnerablePerson[] }>()
  for (const p of persons) {
    const amphoe = p.amphoe ?? '(ไม่ระบุอำเภอ)'
    const tambon = (p as { tambon?: string }).tambon ?? '(ไม่ระบุตำบล)'
    const key = `${amphoe}||${tambon}`
    if (!map.has(key)) map.set(key, { amphoe, tambon, persons: [] })
    map.get(key)!.persons.push(p)
  }
  return [...map.values()]
}

interface LegacyProps {
  persons: VulnerablePerson[]
  canEdit: boolean
  activeIncidents: Incident[]
  onView?: (p: VulnerablePerson) => void
}

export function VulnerableLegacyTable({ persons, canEdit, activeIncidents, onView }: LegacyProps) {
  const router = useRouter()
  const [action, setAction] = useState<{ id: string; name: string; mode: FieldActionMode; lifeSupport: string[] } | null>(null)

  const groups = groupByArea(persons)
  const amphoeMap = new Map<string, typeof groups>()
  for (const g of groups) {
    const arr = amphoeMap.get(g.amphoe) ?? []
    arr.push(g)
    amphoeMap.set(g.amphoe, arr)
  }

  return (
    <div className="gx-card overflow-hidden">
      {persons.length === 0 && (
        <p className="py-10 text-center text-sm text-[var(--fg-subtle)]">ยังไม่มีรายการ</p>
      )}

      {[...amphoeMap.entries()].map(([amphoe, tambons]) => (
        <div key={amphoe}>
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">อ.</span>
            <span className="text-[13px] font-semibold text-[var(--fg)]">{amphoe}</span>
            <span className="ml-auto rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] text-[var(--fg-subtle)]">
              {tambons.reduce((s, t) => s + t.persons.length, 0)} ราย
            </span>
          </div>

          {tambons.map(({ tambon, persons: ps }) => (
            <div key={tambon}>
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--bg-sunken)_50%,var(--bg-elevated))] px-4 py-1.5">
                <span className="text-[10.5px] font-medium text-[var(--fg-subtle)]">ต.{tambon}</span>
                <span className="ml-auto font-mono text-[10.5px] text-[var(--fg-subtle)]">{ps.length} ราย</span>
              </div>

              <table className="gx-table">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>ประเภท</th>
                    <th className="font-mono">อายุ</th>
                    <th>ภาวะ</th>
                    <th>หมู่บ้าน</th>
                    <th>ความเสี่ยง</th>
                    {canEdit && <th className="text-right">จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {ps.map((p) => {
                    const risk = (p.risk ?? 'safe') as RiskLevel
                    return (
                      <tr key={p.id}>
                        <td className="gx-cell-strong">
                          <button
                            type="button"
                            onClick={() => onView?.(p)}
                            className="flex items-center gap-2.5 text-left hover:text-[var(--accent)] hover:underline"
                          >
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: legacyTypeColor[p.type] ?? 'var(--fg-subtle)' }}
                            />
                            {p.name}
                          </button>
                        </td>
                        <td>{p.label}</td>
                        <td className="font-mono">{p.age}</td>
                        <td>{p.cond}</td>
                        <td className="text-[var(--fg-muted)]">{p.vil}</td>
                        <td>
                          <span className={legacyRiskBadge[risk]}>
                            <span aria-hidden className="gx-badge-dot" />
                            {legacyRiskLabel[risk]}
                          </span>
                        </td>
                        {canEdit && (
                          <td>
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'visit', lifeSupport: p.lifeSupport ?? [] })}
                                className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--accent)] hover:!text-[var(--accent)]"
                                title="เยี่ยม"
                              >
                                <Stethoscope size={14} strokeWidth={1.75} />
                                <span className="hidden lg:inline">เยี่ยม</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'help', lifeSupport: p.lifeSupport ?? [] })}
                                className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]"
                                title="ขอช่วยเหลือ"
                              >
                                <LifeBuoy size={14} strokeWidth={1.75} />
                                <span className="hidden lg:inline">ขอช่วยเหลือ</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}

      {action && (
        <FieldActionSheet
          target={{ id: action.id, name: action.name }}
          mode={action.mode}
          activeIncidents={activeIncidents}
          currentLifeSupport={action.lifeSupport}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// ─── New worklist ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<VulnerableType, string> = {
  bedridden: 'var(--risk-flood)',
  elderly:   'var(--risk-near)',
  disabled:  'oklch(0.62 0.18 305)',
  pregnant:  'oklch(0.72 0.14 350)',
  other:     'var(--fg-subtle)',
}

const RISK_META: Record<RiskLevel, {
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  headerBg: string
  headerColor: string
  dot: string
}> = {
  flood: {
    label: 'ในน้ำท่วม',
    Icon: Waves,
    headerBg: 'color-mix(in oklch, var(--risk-flood) 8%, var(--bg-sunken))',
    headerColor: 'var(--risk-flood)',
    dot: 'var(--risk-flood)',
  },
  near: {
    label: 'ใกล้เขตน้ำท่วม',
    Icon: AlertTriangle,
    headerBg: 'color-mix(in oklch, var(--risk-near) 8%, var(--bg-sunken))',
    headerColor: 'var(--risk-near)',
    dot: 'var(--risk-near)',
  },
  safe: {
    label: 'ปลอดภัย',
    Icon: ShieldCheck,
    headerBg: 'color-mix(in oklch, var(--risk-safe) 6%, var(--bg-sunken))',
    headerColor: 'var(--risk-safe)',
    dot: 'var(--risk-safe)',
  },
}

interface Props {
  persons: VulnerablePerson[]
  canEdit: boolean
  activeIncidents: Incident[]
  onView?: (p: VulnerablePerson) => void
}

type ActionState = { id: string; name: string; mode: FieldActionMode; lifeSupport: string[] }

export function VulnerableWorklist({ persons, canEdit, activeIncidents, onView }: Props) {
  const router = useRouter()
  const [action, setAction] = useState<ActionState | null>(null)

  if (persons.length === 0) {
    return (
      <div className="gx-card flex flex-col items-center justify-center py-16 text-center">
        <ShieldCheck size={28} strokeWidth={1.25} className="mb-3 text-[var(--fg-subtle)]" />
        <p className="text-[14px] text-[var(--fg-muted)]">ไม่พบรายการที่ตรงเงื่อนไข</p>
        <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">ลองปรับตัวกรองหรือคำค้นหา</p>
      </div>
    )
  }

  // Split by risk, preserve incoming sort order (already flood→near→safe)
  const byRisk: Record<RiskLevel, VulnerablePerson[]> = { flood: [], near: [], safe: [] }
  for (const p of persons) {
    byRisk[p.risk ?? 'safe'].push(p)
  }

  const sections = (['flood', 'near', 'safe'] as RiskLevel[]).filter(r => byRisk[r].length > 0)

  return (
    <>
      <div className="gx-card overflow-hidden p-0">
        {sections.map((risk, si) => {
          const meta = RISK_META[risk]
          const group = byRisk[risk]
          const Icon = meta.Icon

          return (
            <div key={risk}>
              {/* Section header */}
              <div
                className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5"
                style={{ background: meta.headerBg, color: meta.headerColor }}
              >
                <Icon size={14} strokeWidth={1.75} />
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">
                  {meta.label}
                </span>
                <span className="ml-1 font-mono text-[12px] font-medium">
                  {group.length} ราย
                </span>
              </div>

              {/* Person rows */}
              {group.map((p, pi) => {
                const isLast = pi === group.length - 1 && si === sections.length - 1
                const typeColor = TYPE_COLORS[p.type as VulnerableType] ?? 'var(--fg-subtle)'
                const hasLifeSupport = p.lifeSupport && p.lifeSupport.length > 0
                const area = [p.vil, p.tambon ? `ต.${p.tambon}` : null, p.amphoe ? `อ.${p.amphoe}` : null]
                  .filter(Boolean).join(' ')

                return (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-sunken)] ${!isLast ? 'border-b border-[var(--border)]' : ''} ${onView ? 'cursor-pointer' : ''}`}
                    onClick={() => onView?.(p)}
                  >
                    {/* Type color dot */}
                    <span
                      aria-hidden
                      className="mt-px size-2 shrink-0 rounded-full"
                      style={{ background: typeColor }}
                    />

                    {/* Identity */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-[14px] font-semibold text-[var(--fg)]">{p.name}</span>
                        <span className="font-mono text-[12px] text-[var(--fg-subtle)]">อายุ {p.age}</span>
                        <span className="text-[12px] text-[var(--fg-muted)]">{p.label}</span>
                        {p.cond && (
                          <span className="text-[12px] text-[var(--fg-subtle)]">· {p.cond}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {area && (
                          <span className="text-[11.5px] text-[var(--fg-subtle)]">{area}</span>
                        )}
                        {hasLifeSupport && (
                          <div className="flex flex-wrap gap-1">
                            {p.lifeSupport!.map(eq => (
                              <span
                                key={eq}
                                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                                style={{
                                  background: 'color-mix(in oklch, var(--risk-flood) 10%, transparent)',
                                  color: 'var(--risk-flood)',
                                }}
                              >
                                <Zap size={9} strokeWidth={2.5} />
                                {eq}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'visit', lifeSupport: p.lifeSupport ?? [] })}
                          className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--accent)] hover:!text-[var(--accent)]"
                          title="เยี่ยม"
                        >
                          <Stethoscope size={13} strokeWidth={1.75} />
                          <span className="hidden sm:inline">เยี่ยม</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'help', lifeSupport: p.lifeSupport ?? [] })}
                          className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]"
                          title="ขอช่วย"
                        >
                          <LifeBuoy size={13} strokeWidth={1.75} />
                          <span className="hidden sm:inline">ขอช่วย</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {action && (
        <FieldActionSheet
          target={{ id: action.id, name: action.name }}
          mode={action.mode}
          activeIncidents={activeIncidents}
          currentLifeSupport={action.lifeSupport}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
