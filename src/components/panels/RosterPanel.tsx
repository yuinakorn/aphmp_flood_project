'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { RiskLevel, VulnerablePerson } from '@/types'
import { PanelShell } from './PanelShell'

interface Props {
  persons: VulnerablePerson[]
  onSelect: (p: VulnerablePerson) => void
  onClose: () => void
}

const typeColor: Record<string, string> = {
  bedridden: 'var(--risk-flood)',
  elderly: 'var(--risk-near)',
  disabled: 'oklch(0.62 0.18 305)',
  pregnant: 'oklch(0.72 0.14 350)',
}

const riskLabel: Record<RiskLevel, string> = {
  flood: 'ในเขตน้ำท่วม',
  near: 'ใกล้เขต',
  safe: 'ปลอดภัย',
}

const riskTone: Record<RiskLevel, string> = {
  flood: 'var(--risk-flood)',
  near: 'var(--risk-near)',
  safe: 'var(--risk-safe)',
}

const order: Record<RiskLevel, number> = { flood: 0, near: 1, safe: 2 }

export function RosterPanel({ persons, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...persons]
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.vil.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q),
      )
      .sort((a, b) => order[a.risk ?? 'safe'] - order[b.risk ?? 'safe'])
  }, [persons, query])

  const stats = useMemo(() => {
    const f = persons.filter((p) => p.risk === 'flood').length
    const n = persons.filter((p) => p.risk === 'near').length
    return { f, n, total: persons.length }
  }, [persons])

  return (
    <PanelShell
      title="รายชื่อกลุ่มเปราะบาง"
      hint={`${stats.total} ราย · เสี่ยง ${stats.f + stats.n}`}
      onClose={onClose}
    >
      <div className="border-b border-[var(--border)] px-6 py-5">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ หมู่บ้าน ประเภท…"
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-[12.5px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>
      </div>

      <ul role="list" className="flex flex-col">
        {sorted.length === 0 && (
          <li className="px-6 py-16 text-center text-[12.5px] text-[var(--fg-subtle)]">
            ไม่พบรายการ
          </li>
        )}
        {sorted.map((p) => {
          const risk = p.risk ?? 'safe'
          return (
            <li
              key={p.id}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onSelect(p)}
                className="group block w-full px-6 py-5 text-left transition-colors ease-quart duration-150 hover:bg-[var(--bg)] focus-visible:bg-[var(--bg)] focus-visible:outline-none"
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{ background: typeColor[p.type] }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="truncate text-[14px] font-medium leading-tight text-[var(--fg)]">
                        {p.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--fg-subtle)]">
                        {p.age} ปี
                      </span>
                    </div>
                    <div className="mt-2 truncate text-[12px] leading-tight text-[var(--fg-muted)]">
                      {p.label} <span className="px-1.5 text-[var(--fg-subtle)]">·</span> {p.vil}
                    </div>
                  </div>

                  <span
                    className="flex shrink-0 items-center gap-1.5 pt-1 font-mono text-[10px] uppercase leading-none tracking-[0.08em]"
                    style={{ color: riskTone[risk] }}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: riskTone[risk] }}
                    />
                    {riskLabel[risk]}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
