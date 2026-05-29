'use client'

import { useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import type {
  CmuFloodLayerKey,
  FloodMarkLevel,
  FloodMarkProvince,
  GistdaLayerKey,
  LayerState,
} from '@/types'
import { CMU_FLOOD_LAYERS, FLOOD_MARK_LEVELS, GISTDA_LAYERS } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PanelShell } from './PanelShell'

type BooleanLayerKey = Exclude<keyof LayerState, 'gistda' | 'floodMarks' | 'cmuFlood'>
type SwatchKind =
  | 'flood-mark'
  | 'user-flood-mark'
  | 'gistda'
  | 'vuln'
  | 'infra'
  | 'route'
  | 'cmu-flood'
  | 'cmu-river'
  | 'cmu-parking'
  | 'cmu-shelter'
  | 'cmu-pole'

interface Row {
  key: BooleanLayerKey
  label: string
  meta: string
  swatch: SwatchKind
}

const rows: Row[] = [
  { key: 'vulnerable', label: 'กลุ่มเปราะบาง', meta: 'แสดง risk ตามตำแหน่ง', swatch: 'vuln' },
  { key: 'infra', label: 'สถานพยาบาล / ศูนย์อพยพ', meta: '7 จุด', swatch: 'infra' },
  { key: 'routes', label: 'เส้นทางอพยพ', meta: 'คำนวณ shelter ใกล้สุด', swatch: 'route' },
  { key: 'userFloodMarks', label: 'หมุดที่เจ้าหน้าที่ปัก', meta: 'Flood mark ปักเอง', swatch: 'user-flood-mark' },
]

function Swatch({ kind }: { kind: SwatchKind }) {
  switch (kind) {
    case 'flood-mark':
      return (
        <span
          aria-hidden
          className="size-3 rounded-full ring-1 ring-inset"
          style={{
            background: 'oklch(0.78 0.16 75 / 0.35)',
            boxShadow: 'inset 0 0 0 1px oklch(0.66 0.20 30 / 0.8)',
          }}
        />
      )
    case 'user-flood-mark':
      return (
        <span
          aria-hidden
          className="size-3 rounded-full border border-dashed"
          style={{
            background: 'oklch(0.68 0.15 230 / 0.3)',
            borderColor: 'oklch(0.68 0.15 230)',
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
    case 'cmu-flood':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm border"
          style={{
            background: 'oklch(0.66 0.20 30 / 0.24)',
            borderColor: 'oklch(0.66 0.20 30 / 0.85)',
          }}
        />
      )
    case 'cmu-river':
      return (
        <span
          aria-hidden
          className="block h-0.5 w-3.5 rounded"
          style={{ background: 'oklch(0.68 0.15 230)' }}
        />
      )
    case 'cmu-parking':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm"
          style={{ background: 'oklch(0.78 0.16 75)' }}
        />
      )
    case 'cmu-shelter':
      return (
        <span
          aria-hidden
          className="size-3 rounded-sm"
          style={{ background: 'oklch(0.74 0.10 145)' }}
        />
      )
    case 'cmu-pole':
      return (
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: 'oklch(0.62 0.18 305)' }}
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
          style={{ background: 'linear-gradient(135deg, var(--infra-medical) 0%, var(--infra-shelter) 100%)' }}
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
  floodMarkProvince: string | null
  floodMarkProvinces: FloodMarkProvince[]
  onChange: (key: BooleanLayerKey, value: boolean) => void
  onGistdaChange: (key: GistdaLayerKey, value: boolean) => void
  onFloodMarkChange: (key: FloodMarkLevel, value: boolean) => void
  onCmuFloodChange: (key: CmuFloodLayerKey, value: boolean) => void
  onFloodMarkProvinceChange: (province: string | null) => void
  onClose: () => void
}

export function LayersPanel({
  layers,
  floodMarkProvince,
  floodMarkProvinces,
  onChange,
  onGistdaChange,
  onFloodMarkChange,
  onCmuFloodChange,
  onFloodMarkProvinceChange,
  onClose,
}: Props) {
  const gistdaActive = Object.values(layers.gistda).filter(Boolean).length
  const floodMarkActive = Object.values(layers.floodMarks).filter(Boolean).length
  const cmuFloodActive = Object.values(layers.cmuFlood).filter(Boolean).length
  const [gistdaOpen, setGistdaOpen] = useState(gistdaActive > 0)
  const [floodMarkOpen, setFloodMarkOpen] = useState(floodMarkActive > 0)
  const [cmuFloodOpen, setCmuFloodOpen] = useState(cmuFloodActive > 0)

  return (
    <PanelShell title="ชั้นข้อมูล" hint="Layers" onClose={onClose}>
      <ul className="flex flex-col py-2">
        {rows.map((row) => {
          const on = layers[row.key] as boolean
          return (
            <li key={row.key}>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={on}
                onClick={() => onChange(row.key, !on)}
                className={`h-auto w-full justify-start gap-3.5 rounded-none border-0 px-5 py-3 text-left transition-colors ease-quart duration-150 ${
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
              </Button>
            </li>
          )
        })}

        <li className="mt-1 border-t border-[var(--border)]">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={cmuFloodOpen}
            onClick={() => setCmuFloodOpen((v) => !v)}
            className="h-auto w-full justify-start gap-3.5 rounded-none border-0 px-5 py-3 text-left transition-colors hover:bg-[var(--bg)]"
          >
            <span className="flex size-5 items-center justify-center">
              <Swatch kind="cmu-flood" />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium leading-tight text-[var(--fg)]">
                CMU Water Center
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-[var(--fg-subtle)]">
                watercenter.cmu · {cmuFloodActive}/{CMU_FLOOD_LAYERS.length} active
              </span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={`size-3.5 shrink-0 stroke-[var(--fg-subtle)] transition-transform ${
                cmuFloodOpen ? 'rotate-90' : ''
              }`}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </Button>

          {cmuFloodOpen && (
            <ul className="pb-2">
              {CMU_FLOOD_LAYERS.map((cfg) => {
                const on = layers.cmuFlood[cfg.key]
                const swatch: SwatchKind =
                  cfg.kind === 'flood'
                    ? 'cmu-flood'
                    : cfg.kind === 'river'
                      ? 'cmu-river'
                      : cfg.kind === 'parking'
                        ? 'cmu-parking'
                        : cfg.kind === 'shelter'
                          ? 'cmu-shelter'
                          : 'cmu-pole'

                return (
                  <li key={cfg.key}>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={on}
                      onClick={() => onCmuFloodChange(cfg.key, !on)}
                      className={`h-auto w-full justify-start gap-3.5 rounded-none border-0 py-2 pl-12 pr-5 text-left transition-colors ${
                        on
                          ? 'bg-[var(--bg)] text-[var(--fg)]'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <Swatch kind={swatch} />
                      <span className="flex-1">
                        <span className="block text-[12.5px] font-medium leading-tight">
                          {cfg.label}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] leading-tight text-[var(--fg-subtle)] font-mono">
                          {cfg.meta}
                        </span>
                      </span>
                      <Checkbox on={on} />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </li>

        <li className="mt-1 border-t border-[var(--border)]">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={floodMarkOpen}
            onClick={() => setFloodMarkOpen((v) => !v)}
            className="h-auto w-full justify-start gap-3.5 rounded-none border-0 px-5 py-3 text-left transition-colors hover:bg-[var(--bg)]"
          >
            <span className="flex size-5 items-center justify-center">
              <Swatch kind="flood-mark" />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium leading-tight text-[var(--fg)]">
                Flood Mark
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-[var(--fg-subtle)]">
                watercenter.scmc · {floodMarkActive}/{FLOOD_MARK_LEVELS.length} active
              </span>
            </span>
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={`size-3.5 shrink-0 stroke-[var(--fg-subtle)] transition-transform ${
                floodMarkOpen ? 'rotate-90' : ''
              }`}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </Button>

          {floodMarkOpen && (
            <ul className="pb-2">
              <li className="px-5 pb-2 pl-12 pt-1">
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-between gap-3 rounded-md border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2 text-left text-[12px] text-[var(--fg)] hover:bg-[var(--bg)]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <MapPin className="size-3.5 shrink-0 text-[var(--accent)]" />
                          <span className="truncate">
                            {floodMarkProvince
                              ? `จังหวัด${floodMarkProvince}`
                              : 'ทุกจังหวัด'}
                          </span>
                        </span>
                        <ChevronDown className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                      </Button>
                    }
                  />
                  <PopoverContent
                    align="start"
                    side="right"
                    sideOffset={8}
                    className="w-64 border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 text-[var(--fg)]"
                  >
                    <div className="px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                      โฟกัสจังหวัด
                    </div>
                    <ScrollArea className="max-h-72">
                      <div className="flex flex-col">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onFloodMarkProvinceChange(null)}
                          className={`h-auto justify-start rounded-md px-2.5 py-2 text-left text-[12px] ${
                            !floodMarkProvince
                              ? 'bg-[var(--bg)] text-[var(--fg)]'
                              : 'text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]'
                          }`}
                        >
                          <span className="flex-1">ทุกจังหวัด</span>
                          <span className="font-mono text-[10.5px] text-[var(--fg-subtle)]">
                            {floodMarkProvinces
                              .reduce((sum, item) => sum + item.count, 0)
                              .toLocaleString()}
                          </span>
                        </Button>
                        {floodMarkProvinces.map((province) => (
                          <Button
                            key={province.name}
                            type="button"
                            variant="ghost"
                            onClick={() => onFloodMarkProvinceChange(province.name)}
                            className={`h-auto justify-start rounded-md px-2.5 py-2 text-left text-[12px] ${
                              floodMarkProvince === province.name
                                ? 'bg-[var(--bg)] text-[var(--fg)]'
                                : 'text-[var(--fg-muted)] hover:bg-[var(--bg)] hover:text-[var(--fg)]'
                            }`}
                          >
                            <span className="flex-1">จังหวัด{province.name}</span>
                            <span className="font-mono text-[10.5px] text-[var(--fg-subtle)]">
                              {province.count.toLocaleString()}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </li>
              {FLOOD_MARK_LEVELS.map((cfg) => {
                const on = layers.floodMarks[cfg.key]
                return (
                  <li key={cfg.key}>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={on}
                      onClick={() => onFloodMarkChange(cfg.key, !on)}
                      className={`h-auto w-full justify-start gap-3.5 rounded-none border-0 py-2 pl-12 pr-5 text-left transition-colors ${
                        on
                          ? 'bg-[var(--bg)] text-[var(--fg)]'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full ring-1 ring-inset"
                        style={{
                          background: `color-mix(in oklch, ${cfg.color} 35%, transparent)`,
                          boxShadow: `inset 0 0 0 1px ${cfg.color}`,
                        }}
                      />
                      <span className="flex-1">
                        <span className="block text-[12.5px] font-medium leading-tight">
                          {cfg.label}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] leading-tight text-[var(--fg-subtle)] font-mono">
                          {cfg.meta}
                        </span>
                      </span>
                      <Checkbox on={on} />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </li>

        <li className="mt-1 border-t border-[var(--border)]">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={gistdaOpen}
            onClick={() => setGistdaOpen((v) => !v)}
            className="h-auto w-full justify-start gap-3.5 rounded-none border-0 px-5 py-3 text-left transition-colors hover:bg-[var(--bg)]"
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
          </Button>

          {gistdaOpen && (
            <ul className="pb-2">
              {GISTDA_LAYERS.map((cfg) => {
                const on = layers.gistda[cfg.key]
                return (
                  <li key={cfg.key}>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-pressed={on}
                      onClick={() => onGistdaChange(cfg.key, !on)}
                      className={`h-auto w-full justify-start gap-3.5 rounded-none border-0 py-2 pl-12 pr-5 text-left transition-colors ${
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
                    </Button>
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
