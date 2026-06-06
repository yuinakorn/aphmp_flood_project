'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { VulnerableHouseholdMarker } from '@/types'
import type { CrFloodDepthHit } from '@/lib/geo'
import { PanelShell } from './PanelShell'

interface Props {
  households: VulnerableHouseholdMarker[]
  crFloodHitMap: Map<string, CrFloodDepthHit>
  onSelect: (h: VulnerableHouseholdMarker) => void
  onClose: () => void
}

const DEPTH_COLORS: Record<number, string> = {
  1: 'oklch(0.85 0.08 225)',
  2: 'oklch(0.75 0.12 225)',
  3: 'oklch(0.65 0.16 230)',
  4: 'oklch(0.54 0.19 240)',
  5: 'oklch(0.46 0.22 260)',
  6: 'oklch(0.38 0.22 285)',
  7: 'oklch(0.30 0.20 300)',
}

function DepthBadge({ hit }: { hit: CrFloodDepthHit }) {
  const color = DEPTH_COLORS[hit.level] ?? 'oklch(0.65 0.16 230)'
  const label = hit.label.replace(' m', 'ม.').replace('-', '–')
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white"
      style={{ background: color }}
    >
      {label}
    </span>
  )
}

export function CrFloodRosterPanel({ households, crFloodHitMap, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  // กรองเฉพาะบ้านที่อยู่ในโซนน้ำท่วม
  const floodHouseholds = useMemo(
    () => households.filter((h) => crFloodHitMap.has(h.id)),
    [households, crFloodHitMap],
  )

  const totalVuln = useMemo(
    () => floodHouseholds.reduce((s, h) => s + h.vulnerableCount, 0),
    [floodHouseholds],
  )

  // กรองตาม query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return floodHouseholds
    return floodHouseholds.filter((h) => {
      const addr = [h.hno, h.village, h.tambon, h.amphoe].filter(Boolean).join(' ').toLowerCase()
      return addr.includes(q)
    })
  }, [floodHouseholds, query])

  // จัดกลุ่ม อำเภอ → ตำบล → บ้าน
  // เรียงตาม depth level ลึกที่สุดขึ้นก่อน (อันตรายมากกว่า)
  const grouped = useMemo(() => {
    const ampMap = new Map<string, Map<string, VulnerableHouseholdMarker[]>>()
    for (const h of filtered) {
      const amp = h.amphoe ?? 'ไม่ระบุอำเภอ'
      const tam = h.tambon ?? 'ไม่ระบุตำบล'
      if (!ampMap.has(amp)) ampMap.set(amp, new Map())
      const tamMap = ampMap.get(amp)!
      if (!tamMap.has(tam)) tamMap.set(tam, [])
      tamMap.get(tam)!.push(h)
    }
    // เรียง level ลึกสุดขึ้นก่อนในแต่ละตำบล
    for (const tamMap of ampMap.values()) {
      for (const [tam, list] of tamMap.entries()) {
        tamMap.set(
          tam,
          [...list].sort((a, b) => (crFloodHitMap.get(b.id)?.level ?? 0) - (crFloodHitMap.get(a.id)?.level ?? 0)),
        )
      }
    }
    return ampMap
  }, [filtered, crFloodHitMap])

  return (
    <PanelShell
      title="เปราะบางในโซนน้ำท่วมจำลอง"
      hint="Flood simulation roster"
      onClose={onClose}
    >
      {/* stats bar */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-2.5">
        <span className="text-[12px] font-semibold text-[var(--fg)]">
          {floodHouseholds.length} บ้าน
        </span>
        <span className="text-[var(--fg-subtle)]">·</span>
        <span className="text-[12px] text-[var(--fg-muted)]">
          {totalVuln} คนเปราะบาง
        </span>
        {query && filtered.length !== floodHouseholds.length && (
          <>
            <span className="text-[var(--fg-subtle)]">·</span>
            <span className="text-[11px] text-[var(--fg-subtle)]">
              แสดง {filtered.length} รายการ
            </span>
          </>
        )}
      </div>

      {/* search */}
      <div className="border-b border-[var(--border)] px-4 py-2">
        <label className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-1.5">
          <Search className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
          <input
            type="search"
            placeholder="ค้นหาบ้านเลขที่ หมู่บ้าน ตำบล…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none"
          />
        </label>
      </div>

      {/* list */}
      {floodHouseholds.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12px] text-[var(--fg-subtle)]">
          ยังไม่มีข้อมูล — เปิด layer แบบจำลองน้ำท่วมก่อน
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12px] text-[var(--fg-subtle)]">
          ไม่พบบ้านที่ตรงกับการค้นหา
        </div>
      ) : (
        <ul className="flex flex-col overflow-y-auto">
          {Array.from(grouped.entries()).map(([amphoe, tamMap]) => (
            <li key={amphoe}>
              {/* อำเภอ header */}
              <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg)]">
                  {amphoe}
                </span>
                <span className="ml-2 font-mono text-[10px] text-[var(--fg-subtle)]">
                  {Array.from(tamMap.values()).flat().length} บ้าน
                </span>
              </div>

              {Array.from(tamMap.entries()).map(([tambon, houses]) => (
                <div key={tambon}>
                  {/* ตำบล sub-header */}
                  <div className="border-b border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-1.5 pl-8">
                    <span className="text-[11px] text-[var(--fg-muted)]">ต.{tambon}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-[var(--fg-subtle)]">
                      {houses.length} บ้าน
                    </span>
                  </div>

                  {/* รายชื่อบ้าน */}
                  {houses.map((h) => {
                    const hit = crFloodHitMap.get(h.id)!
                    const villageLabel =
                      h.village && !h.village.startsWith('บ้าน') ? `บ้าน${h.village}` : h.village
                    const hnoLine = [h.villno ? `ม.${h.villno}` : null, villageLabel].filter(Boolean).join(' ')
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => onSelect(h)}
                        className="flex w-full items-start gap-3 border-b border-[var(--border)] px-5 py-2.5 pl-10 text-left transition-colors hover:bg-[var(--bg)]"
                      >
                        {/* depth badge */}
                        <DepthBadge hit={hit} />

                        {/* address block */}
                        <span className="min-w-0 flex-1">
                          {h.hno && (
                            <span className="block text-[12px] font-semibold leading-tight text-[var(--fg)]">
                              บ้านเลขที่ {h.hno}
                            </span>
                          )}
                          {hnoLine && (
                            <span className="mt-0.5 block text-[11px] leading-tight text-[var(--fg-muted)]">
                              {hnoLine}
                            </span>
                          )}
                        </span>

                        {/* vulnerable count */}
                        <span
                          className="mt-0.5 shrink-0 font-mono text-[10.5px] font-semibold"
                          style={{ color: 'var(--risk-flood)' }}
                        >
                          👥 {h.vulnerableCount}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  )
}
