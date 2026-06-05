'use client'

import { useMemo, useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import type { RiskLevel, VulnerablePerson } from '@/types'
import { PanelShell } from './PanelShell'

type FilterKey = 'all' | 'flooded' | 'at_risk'

interface Props {
  persons: VulnerablePerson[]
  initialFilter?: FilterKey
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

// ระดับวิกฤตทางการแพทย์ — A สำคัญสุด (เลขน้อย = ขึ้นก่อน)
const medRank = (p?: string | null) => (p === 'A' ? 0 : p === 'B' ? 1 : p === 'C' ? 2 : 3)

export function RosterPanel({ persons, initialFilter = 'all', onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>(initialFilter)

  // Sync when parent changes initialFilter (e.g. clicking flood count again)
  useEffect(() => {
    setFilter(initialFilter)
  }, [initialFilter])

  // นับ/กรองจากฟิลด์ risk (จำแนกจากพิกัดจริง vs จุดน้ำท่วม) — ตรงกับป้ายที่แสดงในแต่ละแถว
  const counts = useMemo(() => {
    const flooded = persons.filter((p) => (p.risk ?? 'safe') === 'flood').length
    const atRisk = persons.filter((p) => (p.risk ?? 'safe') === 'near').length
    return { flooded, atRisk, total: persons.length }
  }, [persons])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return persons
      .filter((p) => {
        if (filter === 'flooded') return (p.risk ?? 'safe') === 'flood'
        if (filter === 'at_risk') return (p.risk ?? 'safe') === 'near'
        return true
      })
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.vil.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q),
      )
      // จัดอันดับอัตโนมัติ: ความเสี่ยงน้ำ (จริงจากพิกัด) ก่อน แล้วระดับวิกฤตทางการแพทย์
      .sort((a, b) => {
        const r = order[a.risk ?? 'safe'] - order[b.risk ?? 'safe']
        if (r !== 0) return r
        return medRank(a.medicalPriority) - medRank(b.medicalPriority)
      })
  }, [persons, filter, query])

  const TABS: { key: FilterKey; label: string; count: number; color?: string }[] = [
    { key: 'all',      label: 'ทั้งหมด',        count: counts.total },
    { key: 'flooded',  label: 'ในพื้นที่ท่วม',  count: counts.flooded,  color: 'var(--risk-flood)' },
    { key: 'at_risk',  label: 'เสี่ยง',          count: counts.atRisk,   color: 'var(--risk-near)' },
  ]

  return (
    <PanelShell
      title="รายชื่อกลุ่มเปราะบาง"
      hint={`${counts.total} ราย · เสี่ยง ${counts.flooded + counts.atRisk}`}
      onClose={onClose}
    >
      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] px-4 pt-3">
        {TABS.map(({ key, label, count, color }) => {
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className="relative flex items-center gap-1.5 rounded-t px-3 pb-2.5 pt-1.5 text-[11.5px] font-medium transition-colors"
              style={{
                color: active ? (color ?? 'var(--fg)') : 'var(--fg-subtle)',
                background: active ? 'var(--bg-elevated)' : 'transparent',
              }}
            >
              {label}
              <span
                className="font-mono text-[10px] tabular-nums"
                style={{ color: active ? (color ?? 'var(--fg-muted)') : 'var(--fg-subtle)' }}
              >
                {count}
              </span>
              {active && (
                <span
                  className="absolute inset-x-0 bottom-0 h-[2px] rounded-t"
                  style={{ background: color ?? 'var(--accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="border-b border-[var(--border)] px-6 py-4">
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

      {/* List */}
      <ul role="list" className="flex flex-col">
        {filtered.length === 0 && (
          <li className="px-6 py-16 text-center text-[12.5px] text-[var(--fg-subtle)]">
            ไม่พบรายการ
          </li>
        )}
        {filtered.map((p) => {
          const risk = p.risk ?? 'safe'
          const inZone = p.floodLevel != null
          return (
            <li key={p.id} className="border-b border-[var(--border)] last:border-b-0">
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
                      {(p.medicalPriority === 'A' || p.medicalPriority === 'B') && (
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold leading-none"
                          style={{
                            background: p.medicalPriority === 'A' ? 'var(--risk-flood)' : 'var(--risk-near)',
                            color: '#fff',
                          }}
                          title={p.medicalPriority === 'A' ? 'วิกฤต (Priority A)' : 'เร่งด่วน (Priority B)'}
                        >
                          {p.medicalPriority}
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--fg-subtle)]">
                        {p.age} ปี
                      </span>
                    </div>
                    <div className="mt-2 truncate text-[12px] leading-tight text-[var(--fg-muted)]">
                      {p.label}
                      <span className="px-1.5 text-[var(--fg-subtle)]">·</span>
                      {p.vil}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
                    <span
                      className="flex items-center gap-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.08em]"
                      style={{ color: riskTone[risk] }}
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ background: riskTone[risk] }}
                      />
                      {riskLabel[risk]}
                    </span>
                    {inZone && p.floodLevel != null && (
                      <span className="font-mono text-[9.5px] text-[var(--fg-subtle)]">
                        L{p.floodLevel}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
