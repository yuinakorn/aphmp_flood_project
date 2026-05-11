'use client'

import { PanelShell } from './PanelShell'
import type { BasemapType } from '@/types'

interface Props {
  radius: number
  heatRadius: number
  opacity: number
  basemap: BasemapType
  onRadius: (v: number) => void
  onHeatRadius: (v: number) => void
  onOpacity: (v: number) => void
  onBasemap: (b: BasemapType) => void
  onClose: () => void
}

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
          {label}
        </label>
        <span className="font-mono text-[12px] tabular-nums text-[var(--accent)]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="h-1 w-full appearance-none rounded-full bg-[var(--bg-sunken)] accent-[var(--accent)]"
      />
    </div>
  )
}

const basemaps: { key: BasemapType; label: string }[] = [
  { key: 'sat', label: 'ภาพถ่ายดาวเทียม (ESRI)' },
  { key: 'topo', label: 'ภูมิประเทศ' },
  { key: 'street', label: 'แผนที่ถนน (Carto)' },
  { key: 'google', label: 'Google Maps (ถนน)' },
  { key: 'google_sat', label: 'Google Maps (ดาวเทียม)' },
]

export function TunePanel({
  radius,
  heatRadius,
  opacity,
  basemap,
  onRadius,
  onHeatRadius,
  onOpacity,
  onBasemap,
  onClose,
}: Props) {
  return (
    <PanelShell title="ปรับการแสดงผล" hint="Render controls" onClose={onClose}>
      <div className="flex flex-col">
        <div className="border-b border-[var(--border)] py-1">
          <Slider
            label="รัศมีจุดน้ำท่วม"
            value={radius}
            min={50}
            max={800}
            unit=" ม."
            onChange={onRadius}
          />
        </div>
        <div className="border-b border-[var(--border)] py-1">
          <Slider
            label="Heatmap radius"
            value={heatRadius}
            min={5}
            max={40}
            onChange={onHeatRadius}
          />
        </div>
        <div className="border-b border-[var(--border)] py-1">
          <Slider
            label="ความทึบ"
            value={opacity}
            min={10}
            max={90}
            unit=" %"
            onChange={onOpacity}
          />
        </div>

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
                    {on && (
                      <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                    )}
                  </span>
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </PanelShell>
  )
}
