'use client'

import { Maximize2, MapPin, Route as RouteIcon } from 'lucide-react'
import type { FloodPeriod } from '@/types'
import { FLOOD_PERIODS } from '@/types'

interface Props {
  onFitProvince: () => void
  onZoomCity: () => void
  onRouteAll: () => void
  floodPeriod: FloodPeriod
}

export function MapOverlay({ onFitProvince, onZoomCity, onRouteAll, floodPeriod }: Props) {
  const periodLabel =
    FLOOD_PERIODS.find((p) => p.key === floodPeriod)?.label ?? floodPeriod
  return (
    <div className="pointer-events-none absolute inset-0 z-[400]">
      {/* Bottom-left: data attribution */}
      <div className="pointer-events-auto absolute bottom-4 left-4 max-w-[380px] rounded-md border border-[var(--border)] bg-[oklch(0.18_0.012_245/0.88)] px-4 py-2.5 backdrop-blur">
        <div className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-[var(--fg-subtle)]">
          Data sources
        </div>
        <div className="mt-1.5 flex flex-col gap-1 font-mono text-[10.5px] leading-tight text-[var(--fg-muted)]">
          <span>GISTDA Disaster API · features/flood · {periodLabel}</span>
          <span>GISTDA Maps API · TMS (flood, flood-freq, water_hyacinth)</span>
          <span className="text-[var(--fg-subtle)]">api-gateway.gistda.or.th · v2.0</span>
        </div>
      </div>

      {/* Right side: vertical action cluster, vertically centered, separate from Leaflet zoom */}
      <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          onClick={onFitProvince}
          title="ครอบคลุมทั้งหมด"
          aria-label="ครอบคลุมทั้งหมด"
          className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <Maximize2 size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onZoomCity}
          title="จุดศูนย์กลาง"
          aria-label="จุดศูนย์กลาง"
          className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <MapPin size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onRouteAll}
          title="คำนวณเส้นทางอพยพทั้งหมด"
          aria-label="เส้นทางอพยพทั้งหมด"
          className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <RouteIcon size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
