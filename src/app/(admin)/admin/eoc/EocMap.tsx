'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import type { RiskLevel, VulnerablePerson } from '@/types'

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

interface Props {
  persons: VulnerablePerson[]
  selected: VulnerablePerson | null
  onSelect: (p: VulnerablePerson) => void
}

export default function EocMap({ persons, selected, onSelect }: Props) {
  const valid = persons.filter((p) => p.lat && p.lng)
  const points: LatLngExpression[] = valid.map((p) => [p.lat, p.lng])
  const center: LatLngExpression = points[0] ?? [18.78, 100.78]

  return (
    <MapContainer center={center} zoom={12} className="size-full" zoomControl={true} scrollWheelZoom={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains={['a', 'b', 'c', 'd']}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/attributions">CARTO</a>'
        detectRetina
        maxZoom={19}
      />
      <FitBounds points={points} />
      <FlyToSelected person={selected} />
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
