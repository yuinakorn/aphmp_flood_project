'use client'

import { useState } from 'react'
import { Info, ChevronDown } from 'lucide-react'

// สีต้องตรงกับ RISK_COLOR / INFRA ใน FloodMap.tsx
const RISK_ITEMS: { label: string; color: string }[] = [
  { label: 'บ้านในเขตน้ำท่วม', color: 'oklch(0.66 0.20 30)' },
  { label: 'บ้านใกล้เขตน้ำท่วม', color: 'oklch(0.78 0.16 75)' },
  { label: 'บ้านนอกเขต (ปลอดภัย)', color: 'oklch(0.74 0.10 145)' },
]

const INFRA_ITEMS: { label: string; color: string }[] = [
  { label: 'โรงพยาบาล / รพ.สต.', color: 'var(--infra-hospital, oklch(0.62 0.20 250))' },
  { label: 'ศูนย์อพยพ / จุดรวมพล', color: 'var(--infra-shelter, oklch(0.7 0.15 160))' },
  { label: 'จุดรับ-ส่งอพยพ', color: 'oklch(0.62 0.20 250)' },
]

function HouseSwatch({ color }: { color: string }) {
  return (
    <span
      className="grid size-4 shrink-0 place-items-center rounded"
      style={{ background: `color-mix(in oklch, ${color} 22%, var(--bg-elevated))`, border: `2px solid ${color}`, color }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
      </svg>
    </span>
  )
}

export function MapOverlay() {
  const [open, setOpen] = useState(true)

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-[240px]">
      <div className="pointer-events-auto overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/95 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
        >
          <Info className="size-3.5 text-[var(--accent)]" strokeWidth={2} />
          คำอธิบายหมุด
          <ChevronDown className={`ml-auto size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} strokeWidth={2} />
        </button>

        {open && (
          <div className="space-y-3 border-t border-[var(--border)] px-3 py-2.5 text-[11.5px] text-[var(--fg)]">
            <div className="space-y-1.5">
              {RISK_ITEMS.map((it) => (
                <div key={it.label} className="flex items-center gap-2">
                  <HouseSwatch color={it.color} />
                  <span className="leading-tight">{it.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-0.5 text-[var(--fg-muted)]">
                <span className="grid size-4 shrink-0 place-items-center rounded-full border-2 border-[var(--fg-subtle)] font-mono text-[8px] font-bold text-[var(--fg-subtle)]">9</span>
                <span className="leading-tight">กลุ่มบ้าน (ซูมเข้าเพื่อแยก)</span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-[var(--border)] pt-2">
              {INFRA_ITEMS.map((it) => (
                <div key={it.label} className="flex items-center gap-2">
                  <span className="size-3 shrink-0 rounded-[3px]" style={{ background: it.color }} />
                  <span className="leading-tight">{it.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
