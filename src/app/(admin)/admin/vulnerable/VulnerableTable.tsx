'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stethoscope, LifeBuoy, AlertTriangle } from 'lucide-react'
import { FieldActionSheet, type FieldActionMode } from '@/components/forms/FieldActionSheet'
import type { Incident, RiskLevel, VulnerablePerson } from '@/types'

const riskLabel: Record<RiskLevel, string> = {
  flood: 'ในเขตน้ำท่วม',
  near: 'ใกล้เขต',
  safe: 'ปลอดภัย',
}

const typeColor: Record<string, string> = {
  bedridden: 'var(--risk-flood)',
  elderly: 'var(--risk-near)',
  disabled: 'oklch(0.62 0.18 305)',
  pregnant: 'oklch(0.72 0.14 350)',
}

interface Props {
  persons: VulnerablePerson[]
  canEdit: boolean
  activeIncidents: Incident[]
}

export function VulnerableTable({ persons, canEdit, activeIncidents }: Props) {
  const router = useRouter()
  const [action, setAction] = useState<{ id: string; name: string; mode: FieldActionMode } | null>(null)

  const riskClass: Record<RiskLevel, string> = {
    flood: 'gx-badge gx-badge-flood',
    near: 'gx-badge gx-badge-near',
    safe: 'gx-badge gx-badge-safe',
  }

  return (
    <div className="gx-card overflow-hidden">
      {activeIncidents.length > 0 && (
        <div className="gx-banner-crisis rounded-none border-x-0 border-t-0">
          <AlertTriangle size={16} className="shrink-0" />
          โหมดวิกฤต — การบันทึกจะผูกกับ{' '}
          {activeIncidents.length === 1 ? activeIncidents[0].name : `${activeIncidents.length} เหตุการณ์ที่กำลังเกิด`}
        </div>
      )}
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
          {persons.map((p) => {
            const risk = (p.risk ?? 'safe') as RiskLevel
            return (
              <tr key={p.id}>
                <td className="gx-cell-strong">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: typeColor[p.type] }}
                    />
                    {p.name}
                  </div>
                </td>
                <td>{p.label}</td>
                <td className="font-mono">{p.age}</td>
                <td>{p.cond}</td>
                <td>{p.vil}</td>
                <td>
                  <span className={riskClass[risk]}>
                    <span aria-hidden className="gx-badge-dot" />
                    {riskLabel[risk]}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'visit' })}
                        className="gx-btn gx-btn-ghost gx-btn-sm hover:!border-[var(--accent)] hover:!text-[var(--accent)]"
                      >
                        <Stethoscope size={14} strokeWidth={1.75} />
                        เยี่ยม
                      </button>
                      <button
                        type="button"
                        onClick={() => setAction({ id: String(p.id), name: p.name, mode: 'help' })}
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

      {action && (
        <FieldActionSheet
          target={{ id: action.id, name: action.name }}
          mode={action.mode}
          activeIncidents={activeIncidents}
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
