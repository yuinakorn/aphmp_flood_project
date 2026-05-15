'use client'

import { PanelShell } from './PanelShell'
import type { BasemapType } from '@/types'

interface Props {
  basemap: BasemapType
  onBasemap: (b: BasemapType) => void
  onClose: () => void
}

const basemaps: { key: BasemapType; label: string }[] = [
  { key: 'sat', label: 'ภาพถ่ายดาวเทียม (ESRI)' },
  { key: 'topo', label: 'ภูมิประเทศ' },
  { key: 'street', label: 'แผนที่ถนน (Carto)' },
  { key: 'google', label: 'Google Maps (ถนน)' },
  { key: 'google_sat', label: 'Google Maps (ดาวเทียม)' },
]

export function TunePanel({ basemap, onBasemap, onClose }: Props) {
  return (
    <PanelShell title="ปรับการแสดงผล" hint="Render controls" onClose={onClose}>
      <div className="flex flex-col gap-3 px-5 py-4">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          ภาพพื้นหลัง
        </span>
        <div role="radiogroup" className="flex flex-col gap-1.5">
          {basemaps.map((b) => {
            const on = basemap === b.key
            return (
              <button
                key={b.key}
                role="radio"
                aria-checked={on}
                onClick={() => onBasemap(b.key)}
                className={`flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-left text-[12.5px] transition-colors ${
                  on
                    ? 'border-[var(--accent)] bg-[var(--bg)] text-[var(--fg)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`relative flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                    on ? 'border-[var(--accent)]' : 'border-[var(--border-strong)]'
                  }`}
                >
                  {on && <span className="size-1.5 rounded-full bg-[var(--accent)]" />}
                </span>
                {b.label}
              </button>
            )
          })}
        </div>
      </div>
    </PanelShell>
  )
}
