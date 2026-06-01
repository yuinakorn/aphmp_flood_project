'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stethoscope, LifeBuoy } from 'lucide-react'
import { FieldActionSheet, type FieldActionMode } from '@/components/forms/FieldActionSheet'
import type { Incident, RiskLevel, VulnerablePerson } from '@/types'

const riskLabel: Record<RiskLevel, string> = {
  flood: 'ในน้ำ',
  near: 'ใกล้เขต',
  safe: 'ปลอดภัย',
}

const typeColor: Record<string, string> = {
  bedridden: 'var(--risk-flood)',
  elderly: 'var(--risk-near)',
  disabled: 'oklch(0.62 0.18 305)',
  pregnant: 'oklch(0.72 0.14 350)',
}

const riskBadge: Record<RiskLevel, string> = {
  flood: 'gx-badge gx-badge-flood',
  near: 'gx-badge gx-badge-near',
  safe: 'gx-badge gx-badge-safe',
}

interface Props {
  persons: VulnerablePerson[]
  canEdit: boolean
  activeIncidents: Incident[]
}

/** จัดกลุ่ม array เรียง อำเภอ → ตำบล */
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

export function VulnerableTable({ persons, canEdit, activeIncidents }: Props) {
  const router = useRouter()
  const [action, setAction] = useState<{ id: string; name: string; mode: FieldActionMode; lifeSupport: string[] } | null>(null)

  const groups = groupByArea(persons)

  // จัด amphoe section (collapse หลาย tambon ใต้อำเภอเดียว)
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
          {/* หัว อำเภอ */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-subtle)]">อ.</span>
            <span className="text-[13px] font-semibold text-[var(--fg)]">{amphoe}</span>
            <span className="ml-auto rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] text-[var(--fg-subtle)]">
              {tambons.reduce((s, t) => s + t.persons.length, 0)} ราย
            </span>
          </div>

          {tambons.map(({ tambon, persons: ps }) => (
            <div key={tambon}>
              {/* หัว ตำบล */}
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
                          <div className="flex items-center gap-2.5">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: typeColor[p.type] ?? 'var(--fg-subtle)' }}
                            />
                            {p.name}
                          </div>
                        </td>
                        <td>{p.label}</td>
                        <td className="font-mono">{p.age}</td>
                        <td>{p.cond}</td>
                        <td className="text-[var(--fg-muted)]">{p.vil}</td>
                        <td>
                          <span className={riskBadge[risk]}>
                            <span aria-hidden className="gx-badge-dot" />
                            {riskLabel[risk]}
                          </span>
                        </td>
                        {canEdit && (
                          <td>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'visit', lifeSupport: p.lifeSupport ?? [] })}
                                className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--accent)] hover:!text-[var(--accent)]"
                              >
                                <Stethoscope size={14} strokeWidth={1.75} />
                                เยี่ยม
                              </button>
                              <button
                                type="button"
                                onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'help', lifeSupport: p.lifeSupport ?? [] })}
                                className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--risk-flood)] hover:!text-[var(--risk-flood)]"
                              >
                                <LifeBuoy size={14} strokeWidth={1.75} />
                                ขอช่วยเหลือ
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
          onDone={() => {
            setAction(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
