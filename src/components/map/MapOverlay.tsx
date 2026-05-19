'use client'

import { useState } from 'react'
import { Maximize2, MapPin, Route as RouteIcon, X } from 'lucide-react'

interface Props {
  onFitProvince: () => void
  onZoomCity: () => void
  onRouteAll: () => void
}

export function MapOverlay({ onFitProvince, onZoomCity, onRouteAll }: Props) {
  const [showDataSources, setShowDataSources] = useState(true)

  return (
    <div className="pointer-events-none absolute inset-0 z-[400]">
      {/* Bottom-left: data attribution */}
      {showDataSources && (
        <div className="pointer-events-auto absolute bottom-4 left-4 max-w-[380px] rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/90 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-[var(--fg-subtle)]">
              Data sources
            </div>
            <button
              type="button"
              onClick={() => setShowDataSources(false)}
              className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors"
              aria-label="Close data sources"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-1.5 flex flex-col gap-1 font-mono text-[10.5px] leading-tight text-[var(--fg-muted)]">
            <span>GISTDA Maps API · TMS (flood, flood-freq, water_hyacinth)</span>
            <span>CMU Water Center · watercenter.scmc.cmu.ac.th</span>
            <span className="text-[var(--fg-subtle)]">api-gateway.gistda.or.th · v2.0</span>
          </div>
        </div>
      )}

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
