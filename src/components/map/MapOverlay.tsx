'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function MapOverlay() {
  const [showDataSources, setShowDataSources] = useState(true)

  return (
    <div className="pointer-events-none absolute inset-0 z-[400]">
      {/* Bottom-left: data attribution */}
      {showDataSources && (
        <div className="pointer-events-auto absolute bottom-4 left-4 hidden max-w-[380px] rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/90 px-4 py-2.5 backdrop-blur md:block">
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
    </div>
  )
}
