'use client'

import { Route as RouteIcon, MapPin, Trash2 } from 'lucide-react'
import type { Infrastructure, VulnerablePerson } from '@/types'
import { buildEvacRoute, nearestShelter } from '@/lib/geo'
import { PanelShell } from './PanelShell'

interface Props {
  persons: VulnerablePerson[]
  infra: Infrastructure[]
  onRouteAll: () => void
  onClear: () => void
  onShowRoute: (personId: number) => void
  onClose: () => void
}

export function RoutesPanel({
  persons,
  infra,
  onRouteAll,
  onClear,
  onShowRoute,
  onClose,
}: Props) {
  const shelters = infra.filter((i) => i.type === 'shelter' || i.type === 'assembly')
  const atRisk = persons.filter((p) => p.risk === 'flood' || p.risk === 'near')

  return (
    <PanelShell
      title="เส้นทางอพยพ"
      hint={`${atRisk.length} ราย ต้องอพยพ · ${shelters.length} shelter`}
      onClose={onClose}
    >
      <div className="flex gap-2 border-b border-[var(--border)] px-5 py-4">
        <button
          type="button"
          onClick={onRouteAll}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 text-[12px] font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          <RouteIcon size={13} strokeWidth={2} />
          คำนวณทั้งหมด
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] px-3.5 text-[12px] text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--fg)]"
        >
          <Trash2 size={13} strokeWidth={1.75} />
          ล้าง
        </button>
      </div>

      <ul role="list" className="flex flex-col">
        {atRisk.length === 0 && (
          <li className="px-4 py-12 text-center text-[12px] text-[var(--fg-subtle)]">
            ไม่มีผู้ที่อยู่ในเขตเสี่ยง
          </li>
        )}
        {atRisk.map((p) => {
          const shelter = nearestShelter(p, shelters)
          if (!shelter) return null
          const route = buildEvacRoute(p, shelter)
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onShowRoute(p.id)}
                className="flex w-full items-start gap-3.5 border-b border-[var(--border)] px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-[var(--bg)]"
              >
                <MapPin
                  size={14}
                  strokeWidth={1.75}
                  className="mt-1 shrink-0 text-[var(--fg-muted)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[var(--fg)]">
                    {p.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">
                    → {shelter.name}
                  </div>
                </div>
                <span className="mt-0.5 font-mono text-[11px] text-[var(--accent)]">
                  {route.distanceKm} กม.
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </PanelShell>
  )
}
