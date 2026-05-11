'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { RiskLevel, VulnerablePerson } from '@/types'

const riskTone: Record<RiskLevel, string> = {
  flood: 'var(--risk-flood)',
  near: 'var(--risk-near)',
  safe: 'var(--risk-safe)',
}

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
}

export function VulnerableTable({ persons, canEdit }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)] text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            <th className="px-4 py-3 text-left">ชื่อ</th>
            <th className="px-4 py-3 text-left">ประเภท</th>
            <th className="px-4 py-3 text-left font-mono">อายุ</th>
            <th className="px-4 py-3 text-left">ภาวะ</th>
            <th className="px-4 py-3 text-left">หมู่บ้าน</th>
            <th className="px-4 py-3 text-left">ความเสี่ยง</th>
            {canEdit && <th className="px-4 py-3 text-right">จัดการ</th>}
          </tr>
        </thead>
        <tbody>
          {persons.map((p) => {
            const risk = (p.risk ?? 'safe') as RiskLevel
            return (
              <tr
                key={p.id}
                className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--bg-elevated)]"
              >
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: typeColor[p.type] }}
                    />
                    {p.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{p.label}</td>
                <td className="px-4 py-3 font-mono text-[var(--fg-muted)]">
                  {p.age}
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{p.cond}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{p.vil}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em]"
                    style={{ color: riskTone[risk] }}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: riskTone[risk] }}
                    />
                    {riskLabel[risk]}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label="แก้ไข"
                        className="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--accent)]"
                      >
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button
                        aria-label="ลบ"
                        className="flex size-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--risk-flood)]"
                      >
                        <Trash2 size={13} strokeWidth={1.75} />
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
  )
}
