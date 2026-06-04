'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import { Button } from '@/components/ui/button'
import type { RiskLevel, VulnerablePerson } from '@/types'

type BaseMap = 'positron' | 'terrain'

const BASE_MAP: Record<BaseMap, { label: string; url: string; attribution: string; subdomains?: string[]; maxZoom: number }> = {
  positron: {
    label: 'พื้นฐาน',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  terrain: {
    label: 'ภูมิประเทศ',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
}

const RISK_COLOR: Record<RiskLevel, string> = {
  flood: 'oklch(0.58 0.22 28)',
  near: 'oklch(0.66 0.17 70)',
  safe: 'oklch(0.60 0.13 150)',
}

function FitBounds({ points }: { points: LatLngExpression[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14)
    else if (points.length > 1) map.fitBounds(points as [number, number][], { padding: [28, 28], maxZoom: 14 })
  }, [map, points])
  return null
}

function FlyToSelected({ person }: { person: VulnerablePerson | null }) {
  const map = useMap()
  useEffect(() => {
    if (person?.lat && person?.lng) map.flyTo([person.lat, person.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [map, person])
  return null
}

function InvalidateOnResize() {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => {
      try {
        map.invalidateSize()
      } catch {
        // Leaflet can throw during the first layout pass while panes are still settling.
      }
    }
    map.whenReady(invalidate)
    const timers = [80, 220, 420].map((delay) => window.setTimeout(invalidate, delay))
    const observer = new ResizeObserver(invalidate)
    observer.observe(map.getContainer())

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      observer.disconnect()
    }
  }, [map])

  return null
}

function BaseMapControl({ value, onChange }: { value: BaseMap; onChange: (value: BaseMap) => void }) {
  const map = useMap()

  useEffect(() => {
    const el = map.getContainer().querySelector('[data-eoc-basemap-control]')
    if (!(el instanceof HTMLElement)) return

    const stop = (event: Event) => event.stopPropagation()
    el.addEventListener('click', stop)
    el.addEventListener('dblclick', stop)
    el.addEventListener('mousedown', stop)
    el.addEventListener('touchstart', stop)

    return () => {
      el.removeEventListener('click', stop)
      el.removeEventListener('dblclick', stop)
      el.removeEventListener('mousedown', stop)
      el.removeEventListener('touchstart', stop)
    }
  }, [map])

  return (
    <div
      data-eoc-basemap-control
      className="leaflet-top leaflet-right z-[500] m-3 flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 shadow-sm"
      aria-label="เลือกมุมมองแผนที่"
    >
      {(['positron', 'terrain'] as const).map((option) => {
        const active = value === option
        return (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={`rounded-md px-2 text-[11.5px] ${
              active
                ? 'bg-[var(--bg-sunken)] font-semibold text-[var(--fg)]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
            }`}
          >
            {BASE_MAP[option].label}
          </Button>
        )
      })}
    </div>
  )
}

interface Props {
  persons: VulnerablePerson[]
  selected: VulnerablePerson | null
  onSelect: (p: VulnerablePerson) => void
  scrollWheelZoom?: boolean
}

export default function EocMap({ persons, selected, onSelect, scrollWheelZoom = false }: Props) {
  const [baseMap, setBaseMap] = useState<BaseMap>('positron')
  const tile = BASE_MAP[baseMap]
  const valid = persons.filter((p) => p.lat && p.lng)
  const points: LatLngExpression[] = valid.map((p) => [p.lat, p.lng])
  const center: LatLngExpression = points[0] ?? [18.78, 100.78]

  return (
    <MapContainer center={center} zoom={12} className="size-full" zoomControl={true} scrollWheelZoom={scrollWheelZoom}>
      <TileLayer
        key={baseMap}
        url={tile.url}
        subdomains={tile.subdomains}
        attribution={tile.attribution}
        detectRetina
        maxZoom={tile.maxZoom}
      />
      <FitBounds points={points} />
      <FlyToSelected person={selected} />
      <InvalidateOnResize />
      <BaseMapControl value={baseMap} onChange={setBaseMap} />
      {valid.map((p) => {
        const risk = (p.risk ?? 'safe') as RiskLevel
        const isSel = selected?.id === p.id
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={isSel ? 9 : 6}
            pathOptions={{
              color: isSel ? 'var(--accent)' : '#fff',
              weight: isSel ? 3 : 1.5,
              fillColor: RISK_COLOR[risk],
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs font-medium">{p.name}</span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
