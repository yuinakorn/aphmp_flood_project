'use client'

import type { LayerState } from '@/types'
import { PanelShell } from './PanelShell'

interface Row {
  key: keyof LayerState
  label: string
  meta: string
  swatch: 'heat' | 'flood-circle' | 'gistda' | 's2' | 'vuln' | 'infra' | 'route'
}

const rows: Row[] = [
  { key: 'heatmap', label: 'Heatmap น้ำท่วม', meta: 'Sentinel-1 SAR · GEE', swatch: 'heat' },
  { key: 'circles', label: 'จุดน้ำท่วม', meta: 'วงกลมตามรัศมี', swatch: 'flood-circle' },
  { key: 's2flood', label: 'พื้นที่น้ำท่วม', meta: 'Sentinel-2 · 24 ก.ค. 2568', swatch: 's2' },
  { key: 'gistda', label: 'GISTDA WMS', meta: 'flood_2024_geo · ใช้ token', swatch: 'gistda' },
  { key: 'vulnerable', label: 'กลุ่มเปราะบาง', meta: 'แสดง risk ตามตำแหน่ง', swatch: 'vuln' },
  { key: 'infra', label: 'สถานพยาบาล / ศูนย์อพยพ', meta: '7 จุด', swatch: 'infra' },
  { key: 'routes', label: 'เส้นทางอพยพ', meta: 'คำนวณ shelter ใกล้สุด', swatch: 'route' },
]

function Swatch({ kind }: { kind: Row['swatch'] }) {
  switch (kind) {
    case 'heat':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm"
          style={{
            background:
              'linear-gradient(90deg, oklch(0.78 0.16 75), oklch(0.66 0.20 30), oklch(0.55 0.22 25))',
          }}
        />
      )
    case 'flood-circle':
      return (
        <span
          aria-hidden
          className="size-3 rounded-full ring-1 ring-inset"
          style={{
            background: 'oklch(0.66 0.20 30 / 0.35)',
            boxShadow: 'inset 0 0 0 1px oklch(0.66 0.20 30 / 0.8)',
          }}
        />
      )
    case 's2':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm border"
          style={{
            background: 'oklch(0.68 0.15 230 / 0.25)',
            borderColor: 'oklch(0.68 0.15 230 / 0.8)',
          }}
        />
      )
    case 'gistda':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm"
          style={{ background: 'oklch(0.78 0.14 200 / 0.4)' }}
        />
      )
    case 'vuln':
      return (
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: 'var(--risk-flood)' }}
        />
      )
    case 'infra':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm"
          style={{ background: 'var(--risk-safe)' }}
        />
      )
    case 'route':
      return (
        <span
          aria-hidden
          className="block h-0.5 w-3.5 rounded"
          style={{
            background:
              'repeating-linear-gradient(90deg, var(--risk-flood) 0 4px, transparent 4px 7px)',
          }}
        />
      )
  }
}

interface Props {
  layers: LayerState
  onChange: (key: keyof LayerState, value: boolean) => void
  onClose: () => void
}

export function LayersPanel({ layers, onChange, onClose }: Props) {
  return (
    <PanelShell title="ชั้นข้อมูล" hint="Layers · 7 sources" onClose={onClose}>
      <ul className="flex flex-col py-2">
        {rows.map((row) => {
          const on = layers[row.key]
          return (
            <li key={row.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(row.key, !on)}
                className={`flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors ease-quart duration-150 ${
                  on
                    ? 'bg-[var(--bg)] text-[var(--fg)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--bg)]'
                }`}
              >
                <span className="flex size-5 items-center justify-center">
                  <Swatch kind={row.swatch} />
                </span>
                <span className="flex-1">
                  <span className="block text-[13px] font-medium leading-tight">
                    {row.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-[var(--fg-subtle)]">
                    {row.meta}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`relative size-4 shrink-0 rounded-sm border transition-colors ${
                    on
                      ? 'border-[var(--accent)] bg-[var(--accent)]'
                      : 'border-[var(--border-strong)]'
                  }`}
                >
                  {on && (
                    <svg
                      viewBox="0 0 16 16"
                      className="absolute inset-0 size-4 stroke-[var(--accent-fg)]"
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 8.5l3 3 6-6.5" />
                    </svg>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
