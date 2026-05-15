'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { MapWrapper } from '@/components/map/MapWrapper'
import { Masthead } from '@/components/shell/Masthead'
import { StatusStrip } from '@/components/shell/StatusStrip'
import { Rail, type RailPanel } from '@/components/shell/Rail'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { RosterPanel } from '@/components/panels/RosterPanel'
import { RoutesPanel } from '@/components/panels/RoutesPanel'
import { InfraPanel } from '@/components/panels/InfraPanel'
import { TunePanel } from '@/components/panels/TunePanel'
import { MapOverlay } from '@/components/map/MapOverlay'
import { buildEvacRoute, nearestShelter } from '@/lib/geo'
import type {
  BasemapType,
  CmuFloodLayerKey,
  FloodMarkLevel,
  FloodMarkProvince,
  FloodPeriod,
  FloodStats,
  GistdaLayerKey,
  Infrastructure,
  LayerState,
  VulnerablePerson,
  VulnerableStats,
} from '@/types'

const DEFAULT_LAYERS: LayerState = {
  heatmap: true,
  circles: false,
  gistda: {
    flood1d: false,
    flood3d: false,
    flood7d: false,
    flood30d: false,
    floodFreq: false,
    waterHyacinth: false,
  },
  floodMarks: {
    '1': false,
    '2': false,
    '3': false,
    '4': false,
    '5': false,
  },
  cmuFlood: {
    flood1: false,
    flood2: false,
    flood3: false,
    flood4: false,
    flood5: false,
    river: false,
    parking: false,
    shelter: false,
    pole: false,
  },
  s2flood: true,
  vulnerable: true,
  infra: true,
  routes: true,
}

const FLOOD_STATS: FloodStats = {
  total: 813,
  areaSqKm: 50.7,
  sarPasses: 14,
  baselinePasses: 30,
}

export function MapClient() {
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS)
  const [activePanel, setActivePanel] = useState<RailPanel>('roster')
  const [vulnerable, setVulnerable] = useState<VulnerablePerson[]>([])
  const [infra, setInfra] = useState<Infrastructure[]>([])
  const [floodMarkProvinces, setFloodMarkProvinces] = useState<FloodMarkProvince[]>([])
  const [floodMarkProvince, setFloodMarkProvince] = useState<string | null>(null)
  const [vulnStats, setVulnStats] = useState<VulnerableStats>({
    flood: 0,
    near: 0,
    safe: 0,
    total: 0,
  })

  const [radius, setRadius] = useState(300)
  const [heatRadius, setHeatRadius] = useState(18)
  const [opacity, setOpacity] = useState(45)
  const [basemap, setBasemap] = useState<BasemapType>('google_sat')
  const [floodPeriod, setFloodPeriod] = useState<FloodPeriod>('7days')

  const mapRef = useRef<LeafletMap | null>(null)
  const routeGroupRef = useRef<LayerGroup | null>(null)

  // Load data
  useEffect(() => {
    Promise.all([
      fetch('/api/vulnerable').then((r) => r.json()),
      fetch('/data/infrastructure.json').then((r) => r.json()),
    ])
      .then(([v, i]) => {
        setVulnerable(v as VulnerablePerson[])
        setInfra(i as Infrastructure[])
        const flood = (v as VulnerablePerson[]).filter((p) => p.risk === 'flood').length
        const near = (v as VulnerablePerson[]).filter((p) => p.risk === 'near').length
        setVulnStats({
          flood,
          near,
          safe: v.length - flood - near,
          total: v.length,
        })
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    fetch('/api/flood-mark-provinces')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFloodMarkProvinces(data as FloodMarkProvince[])
      })
      .catch(console.error)
  }, [])

  // Keyboard shortcuts: L/R/E/I/T toggle panels; Esc closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (e.key === 'Escape') return setActivePanel(null)
      const key = e.key.toLowerCase()
      const map: Record<string, RailPanel> = {
        l: 'layers',
        r: 'roster',
        e: 'routes',
        i: 'infra',
        t: 'tune',
      }
      if (map[key]) {
        setActivePanel((prev) => (prev === map[key] ? null : map[key]))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const onLayerChange = useCallback((k: keyof LayerState, v: boolean) => {
    setLayers((p) => ({ ...p, [k]: v }))
  }, [])

  const onGistdaChange = useCallback((k: GistdaLayerKey, v: boolean) => {
    setLayers((p) => ({ ...p, gistda: { ...p.gistda, [k]: v } }))
  }, [])

  const onFloodMarkChange = useCallback((k: FloodMarkLevel, v: boolean) => {
    setLayers((p) => ({ ...p, floodMarks: { ...p.floodMarks, [k]: v } }))
  }, [])

  const onCmuFloodChange = useCallback((k: CmuFloodLayerKey, v: boolean) => {
    setLayers((p) => ({ ...p, cmuFlood: { ...p.cmuFlood, [k]: v } }))
  }, [])

  const onFloodMarkProvinceChange = useCallback(
    (province: string | null) => {
      setFloodMarkProvince(province)
      if (!province) return

      const selected = floodMarkProvinces.find((item) => item.name === province)
      if (!selected) return

      mapRef.current?.flyToBounds(selected.bounds, {
        duration: 0.7,
        padding: [36, 36],
      })
    },
    [floodMarkProvinces],
  )

  const flyTo = useCallback((person: VulnerablePerson) => {
    mapRef.current?.flyTo([person.lat, person.lng], 16, { duration: 0.6 })
  }, [])

  const flyToInfra = useCallback((item: Infrastructure) => {
    mapRef.current?.flyTo([item.lat, item.lng], 16, { duration: 0.6 })
  }, [])

  const fitProvince = useCallback(() => {
    mapRef.current?.flyToBounds(
      [[18.01, 100.39], [19.56, 101.26]],
      { duration: 0.7 },
    )
  }, [])

  const zoomCity = useCallback(() => {
    mapRef.current?.flyTo([18.78, 100.78], 14, { duration: 0.5 })
  }, [])

  const drawRoute = useCallback(
    async (personId: number) => {
      const person = vulnerable.find((p) => p.id === personId)
      if (!person) return
      const shelters = infra.filter(
        (x) => x.type === 'shelter' || x.type === 'assembly',
      )
      const shelter = nearestShelter(person, shelters)
      if (!shelter) return
      const route = buildEvacRoute(person, shelter)
      const map = mapRef.current
      if (!map) return
      const L = (await import('leaflet')).default
      if (!routeGroupRef.current) {
        routeGroupRef.current = L.layerGroup().addTo(map)
      }
      L.polyline(route.coords as [number, number][], {
        color: 'oklch(0.66 0.20 30)',
        weight: 2.5,
        opacity: 0.95,
        dashArray: '6, 6',
      })
        .bindPopup(
          `<div>
            <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">เส้นทางอพยพ</div>
            <div style="font-size:13px;font-weight:600;margin-bottom:2px">${person.name}</div>
            <div style="font-size:12px;color:var(--fg-muted);margin-bottom:6px">→ ${shelter.name}</div>
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent)">${route.distanceKm} กม.</div>
          </div>`,
        )
        .addTo(routeGroupRef.current)
    },
    [vulnerable, infra],
  )

  const routeAll = useCallback(async () => {
    routeGroupRef.current?.clearLayers()
    for (const p of vulnerable) {
      if (p.risk === 'flood' || p.risk === 'near') {
        await drawRoute(p.id)
      }
    }
  }, [vulnerable, drawRoute])

  const clearRoutes = useCallback(() => {
    routeGroupRef.current?.clearLayers()
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <a href="#map-region" className="skip-to-map">
        ข้ามไปที่แผนที่
      </a>
      <Masthead />
      <StatusStrip flood={FLOOD_STATS} vulnerable={vulnStats} fresh />

      <div className="flex flex-1 overflow-hidden">
        <Rail active={activePanel} onSelect={setActivePanel} />

        {activePanel === 'layers' && (
          <LayersPanel
            layers={layers}
            floodMarkProvince={floodMarkProvince}
            floodMarkProvinces={floodMarkProvinces}
            onChange={onLayerChange}
            onGistdaChange={onGistdaChange}
            onFloodMarkChange={onFloodMarkChange}
            onCmuFloodChange={onCmuFloodChange}
            onFloodMarkProvinceChange={onFloodMarkProvinceChange}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'roster' && (
          <RosterPanel
            persons={vulnerable}
            onSelect={flyTo}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'routes' && (
          <RoutesPanel
            persons={vulnerable}
            infra={infra}
            onRouteAll={routeAll}
            onClear={clearRoutes}
            onShowRoute={drawRoute}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'infra' && (
          <InfraPanel
            infra={infra}
            onSelect={flyToInfra}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'tune' && (
          <TunePanel
            radius={radius}
            heatRadius={heatRadius}
            opacity={opacity}
            basemap={basemap === 'hybrid' ? 'sat' : basemap}
            floodPeriod={floodPeriod}
            onRadius={setRadius}
            onHeatRadius={setHeatRadius}
            onOpacity={setOpacity}
            onBasemap={setBasemap}
            onFloodPeriod={setFloodPeriod}
            onClose={() => setActivePanel(null)}
          />
        )}

        <div id="map-region" role="region" aria-label="แผนที่น้ำท่วม" className="relative flex-1">
          <MapWrapper
            layers={layers}
            vulnerable={vulnerable}
            infra={infra}
            radius={radius}
            heatRadius={heatRadius}
            opacity={opacity}
            basemap={basemap}
            floodPeriod={floodPeriod}
            floodMarkProvince={floodMarkProvince}
            onMapReady={(m) => (mapRef.current = m)}
            onRequestRoute={drawRoute}
          />
          <MapOverlay
            onFitProvince={fitProvince}
            onZoomCity={zoomCity}
            onRouteAll={routeAll}
            floodPeriod={floodPeriod}
          />
        </div>
      </div>
    </div>
  )
}
