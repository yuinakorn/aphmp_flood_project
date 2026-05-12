'use client'

import { useState } from 'react'
import type { GistdaLayerKey, LayerState } from '@/types'
import { GISTDA_LAYERS } from '@/types'
import { PanelShell } from './PanelShell'

interface Row {
  key: keyof LayerState
  label: string
  meta: string
  swatch: 'heat' | 'flood-circle' | 'gistda' | 's2' | 'vuln' | 'infra' | 'route'
}

const rows: Row[] = [
  { key: 'heatmap', label: 'Heatmap น้ำท่วม', meta: 'GISTDA · centroid พื้นที่น้ำท่วม', swatch: 'heat' },
  { key: 'circles', label: 'จุดน้ำท่วม', meta: 'GISTDA · วงกลมตามรัศมี', swatch: 'flood-circle' },
  { key: 's2flood', label: 'พื้นที่น้ำท่วม', meta: 'GISTDA · polygon ตามช่วงเวลา', swatch: 's2' },
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

function Checkbox({ on }: { on: boolean }) {
  return (
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
  )
}

interface Props {
  layers: LayerState
  onChange: (key: keyof LayerState, value: boolean) => void
  onGistdaChange: (key: GistdaLayerKey, value: boolean) => void
  onClose: () => void
}

export function LayersPanel({ layers, onChange, onGistdaChange, onClose }: Props) {
  const gistdaActive = Object.values(layers.gistda).filter(Boolean).length
  const [gistdaOpen, setGistdaOpen] = useState(gistdaActive > 0)

  return (
    <PanelShell title="ชั้นข้อมูล" hint="Layers" onClose={onClose}>
      <ul className="flex flex-col py-2">
        {rows.map((row) => {
          const on = layers[row.key] as boolean
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
                <Checkbox on={on} />
              </button>
            </li>
          )
        })}

        <li className="mt-1 border-t border-[var(--border)]">
          <button
            type="button"
            aria-expanded={gistdaOpen}
            onClick={() => setGistdaOpen((v) => !v)}
            className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-[var(--bg)]"
          >
            <span className="flex size-5 items-center justify-center">
              <Swatch kind="gistda" />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium leading-tight text-[var(--fg)]">
                GISTDA API
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-[var(--fg-subtle)]">
                disaster.gistda · {gistdaActive}/{GISTDA_LAYERS.length} active
              </span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={`size-3.5 shrink-0 stroke-[var(--fg-subtle)] transition-transform ${
                gistdaOpen ? 'rotate-90' : ''
              }`}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </button>

          {gistdaOpen && (
            <ul className="pb-2">
              {GISTDA_LAYERS.map((cfg) => {
                const on = layers.gistda[cfg.key]
                return (
                  <li key={cfg.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onGistdaChange(cfg.key, !on)}
                      className={`flex w-full items-center gap-3.5 py-2 pl-12 pr-5 text-left transition-colors ${
                        on
                          ? 'bg-[var(--bg)] text-[var(--fg)]'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <span className="flex-1">
                        <span className="block text-[12.5px] font-medium leading-tight">
                          {cfg.label}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] leading-tight text-[var(--fg-subtle)] font-mono">
                          {cfg.meta}
                        </span>
                      </span>
                      <Checkbox on={on} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </li>
      </ul>
    </PanelShell>
  )
}
