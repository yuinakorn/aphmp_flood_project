'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { FloodMap } from './FloodMap'

const FloodMapDynamic = dynamic(
  () => import('./FloodMap').then((m) => ({ default: m.FloodMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-[var(--bg-sunken)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-pulse rounded-full bg-[var(--signal-data)] opacity-60" />
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
            initializing map
          </span>
        </div>
      </div>
    ),
  },
)

export function MapWrapper(props: ComponentProps<typeof FloodMap>) {
  return <FloodMapDynamic {...props} />
}
