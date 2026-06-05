'use client'

import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import type { RiskLevel, VulnerableHouseholdMarker } from '@/types'
import { PanelShell } from './PanelShell'

interface Props {
  households: VulnerableHouseholdMarker[]
  filterRisk: Set<RiskLevel>
  filterGroups: Set<string>
  filterTambons: Set<string>
  onToggleRisk: (v: RiskLevel) => void
  onToggleGroup: (v: string) => void
  onToggleTambon: (v: string) => void
  onClear: () => void
  resultCount: number
  onClose: () => void
}

const RISK_META: { key: RiskLevel; label: string; color: string }[] = [
  { key: 'flood', label: 'ในเขตน้ำท่วม', color: 'oklch(0.66 0.20 30)' },
  { key: 'near', label: 'ใกล้เขต', color: 'oklch(0.78 0.16 75)' },
  { key: 'safe', label: 'ปลอดภัย', color: 'oklch(0.74 0.10 145)' },
]

// หมวดเปราะบางละเอียด (ระดับคน) — ตรงกับ memberCategories ใน lib/family-folder
const CATEGORY_META: { key: string; label: string; color: string }[] = [
  { key: 'bedridden', label: 'ผู้ป่วยติดเตียง', color: 'oklch(0.66 0.20 30)' },
  { key: 'dialysis', label: 'ผู้ป่วยฟอกไต', color: 'oklch(0.62 0.20 250)' },
  { key: 'oxygen', label: 'ผู้ป่วยใช้ออกซิเจน', color: 'oklch(0.68 0.16 200)' },
  { key: 'disabled', label: 'ผู้พิการ', color: 'oklch(0.62 0.18 305)' },
  { key: 'pregnant', label: 'สตรีมีครรภ์', color: 'oklch(0.72 0.14 350)' },
  { key: 'elderly', label: 'ผู้สูงอายุ (≥70)', color: 'oklch(0.78 0.16 75)' },
  { key: 'child', label: 'เด็กเล็ก (≤5)', color: 'oklch(0.74 0.13 140)' },
]

function Chip({
  label, count, active, color, onClick,
}: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
        active
          ? 'border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--fg)]'
          : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]'
      }`}
    >
      {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span>{label}</span>
      <span className="font-mono text-[10.5px] text-[var(--fg-subtle)]">{count}</span>
    </button>
  )
}

export function FilterPanel({
  households, filterRisk, filterGroups, filterTambons,
  onToggleRisk, onToggleGroup, onToggleTambon, onClear, resultCount, onClose,
}: Props) {
  const riskCounts = useMemo(() => {
    const c: Record<RiskLevel, number> = { flood: 0, near: 0, safe: 0 }
    households.forEach((h) => { c[(h.risk ?? 'safe') as RiskLevel] += 1 })
    return c
  }, [households])

  // นับจำนวน "บ้าน" ที่มีสมาชิกอย่างน้อย 1 คนในหมวดนั้น
  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {}
    households.forEach((h) => {
      const seen = new Set<string>()
      h.members.forEach((m) => {
        (m.categories ?? []).forEach((cat) => {
          if (!seen.has(cat)) { seen.add(cat); c[cat] = (c[cat] ?? 0) + 1 }
        })
      })
    })
    return c
  }, [households])

  const tambons = useMemo(() => {
    const c: Record<string, number> = {}
    households.forEach((h) => { if (h.tambon) c[h.tambon] = (c[h.tambon] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => a[0].localeCompare(b[0], 'th'))
  }, [households])

  const hasActive = filterRisk.size + filterGroups.size + filterTambons.size > 0

  return (
    <PanelShell title="ตัวกรองหมุด" hint={`แสดง ${resultCount} / ${households.length} บ้าน`} onClose={onClose}>
      <div className="flex flex-col gap-5 px-6 py-4">
        {hasActive && (
          <button
            type="button"
            onClick={onClear}
            className="flex w-fit items-center gap-1.5 text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            <RotateCcw className="size-3.5" /> ล้างตัวกรองทั้งหมด
          </button>
        )}

        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">ความเสี่ยงน้ำท่วม</span>
          <div className="flex flex-wrap gap-1.5">
            {RISK_META.map((r) => (
              <Chip key={r.key} label={r.label} color={r.color} count={riskCounts[r.key]}
                active={filterRisk.has(r.key)} onClick={() => onToggleRisk(r.key)} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">กลุ่มเปราะบาง</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_META.map((g) => (
              <Chip key={g.key} label={g.label} color={g.color} count={categoryCounts[g.key] ?? 0}
                active={filterGroups.has(g.key)} onClick={() => onToggleGroup(g.key)} />
            ))}
          </div>
        </section>

        {tambons.length > 0 && (
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">ตำบล</span>
            <div className="flex flex-wrap gap-1.5">
              {tambons.map(([t, n]) => (
                <Chip key={t} label={t} count={n}
                  active={filterTambons.has(t)} onClick={() => onToggleTambon(t)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PanelShell>
  )
}
