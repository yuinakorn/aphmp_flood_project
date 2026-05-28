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
import { WaterLevelSidebar } from '@/components/map/WaterLevelSidebar'
import { FloodAlertBanner } from '@/components/map/FloodAlertBanner'
import { UserFloodMarkForm } from '@/components/map/UserFloodMarkForm'
import { MapPinPlus } from 'lucide-react'
import { buildEvacRouteOSRM, nearestShelter } from '@/lib/geo'
import type { AlertLevel, ProvinceId } from '@/lib/water-level'
import { PROVINCE_CONFIGS } from '@/lib/water-level'

type StationSnap = { level: number | null; alert: AlertLevel }
type ProvinceSummarySnap = { s1: StationSnap; s2: StationSnap }
import type { FloodAlertResponse } from '@/app/api/cmu-flood-alert/route'
import type {
  BasemapType,
  CmuFloodLayerKey,
  FloodMarkLevel,
  FloodMarkProvince,
  GistdaLayerKey,
  Infrastructure,
  LayerState,
  UserFloodMark,
  VulnerablePerson,
  VulnerableStats,
} from '@/types'

const WRITE_ROLES = new Set(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm'])

const DEFAULT_LAYERS: LayerState = {
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
    s1a: false,
  },
  vulnerable: true,
  infra: true,
  routes: true,
  userFloodMarks: true,
}

const ALERT_POLL_MS = 5 * 60 * 1000

interface Props {
  session?: { role: string; name: string } | null
}

export function MapClient({ session }: Props) {
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS)
  const [activePanel, setActivePanel] = useState<RailPanel>('roster')
  const [vulnerable, setVulnerable] = useState<VulnerablePerson[]>([])
  const [infra, setInfra] = useState<Infrastructure[]>([])
  const [floodMarkProvinces, setFloodMarkProvinces] = useState<FloodMarkProvince[]>([])
  const [floodMarkProvince, setFloodMarkProvince] = useState<string | null>(null)
  const [userFloodMarks, setUserFloodMarks] = useState<UserFloodMark[]>([])
  const [pinMode, setPinMode] = useState(false)
  const [pinDraft, setPinDraft] = useState<{ lat: number; lng: number } | null>(null)
  const canPin = !!session && WRITE_ROLES.has(session.role)
  const [vulnStats, setVulnStats] = useState<VulnerableStats>({
    flood: 0,
    near: 0,
    safe: 0,
    total: 0,
  })
  const [waterLevel, setWaterLevel] = useState<number | null>(null)
  const [activeZone, setActiveZone] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('normal')
  const [alertUpdatedAt, setAlertUpdatedAt] = useState<string | null>(null)
  const [summarySnap, setSummarySnap] = useState<Record<string, ProvinceSummarySnap>>({})
  const [province, setProvince] = useState<ProvinceId>('chiangmai')
  const [rosterFilter, setRosterFilter] = useState<'all' | 'flooded' | 'at_risk'>('all')

  const [basemap, setBasemap] = useState<BasemapType>('google_sat')

  const [focusPersonId, setFocusPersonId] = useState<number | null>(null)

  const mapRef = useRef<LeafletMap | null>(null)
  const routeGroupRef = useRef<LayerGroup | null>(null)

  // Load map markers
  useEffect(() => {
    Promise.all([
      fetch('/api/vulnerable')
        .then((r) => {
          if (!r.ok) throw new Error(`API error: ${r.status}`)
          return r.json()
        })
        .catch((e) => {
          console.error('Failed to load vulnerable persons:', e)
          return []
        }),
      fetch('/data/infrastructure.json')
        .then((r) => {
          if (!r.ok) throw new Error(`API error: ${r.status}`)
          return r.json()
        })
        .catch((e) => {
          console.error('Failed to load infrastructure:', e)
          return []
        }),
    ]).then(([v, i]) => {
      setVulnerable(Array.isArray(v) ? v : [])
      setInfra(Array.isArray(i) ? i : [])
    })
  }, [])

  // Load CMU flood alert stats (PIP-based counts + water level)
  useEffect(() => {
    const load = () =>
      fetch('/api/cmu-flood-alert')
        .then((r) => r.json())
        .then((data: FloodAlertResponse) => {
          setWaterLevel(data.waterLevel)
          setActiveZone(data.activeZone)
          setAlertLevel(data.alertLevel)
          setAlertUpdatedAt(data.updatedAt)

          const { counts, affectedTotal, activeZone: az } = data
          const nearTotal =
            ([1, 2, 3, 4, 5] as const)
              .filter((l) => az == null || l > az)
              .reduce((sum, l) => sum + (counts[`level${l}` as keyof typeof counts] as number), 0)
          const total =
            counts.level1 + counts.level2 + counts.level3 +
            counts.level4 + counts.level5 + counts.outside
          setVulnStats({
            flood: affectedTotal,
            near: nearTotal,
            safe: counts.outside,
            total,
          })
        })
        .catch(console.error)

    load()
    const id = setInterval(load, ALERT_POLL_MS)
    return () => clearInterval(id)
  }, [])

  // Fetch water-level summary for all provinces (s1 + s2 levels)
  useEffect(() => {
    const load = () =>
      fetch('/api/water-level/summary')
        .then((r) => r.json())
        .then((data: Record<string, { s1: StationSnap; s2: StationSnap }>) => {
          setSummarySnap(data)
        })
        .catch(console.error)
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/flood-mark-provinces')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFloodMarkProvinces(data as FloodMarkProvince[])
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    fetch('/api/user-flood-marks')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUserFloodMarks(data as UserFloodMark[])
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
        w: 'water',
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

  const onPinPlace = useCallback((lat: number, lng: number) => {
    setPinDraft({ lat, lng })
    setPinMode(false)
  }, [])

  const onMarkCreated = useCallback((mark: UserFloodMark) => {
    setUserFloodMarks((prev) => [mark, ...prev])
    setPinDraft(null)
    setLayers((p) => ({ ...p, userFloodMarks: true }))
  }, [])

  const flyTo = useCallback((person: VulnerablePerson) => {
    mapRef.current?.flyTo([person.lat, person.lng], 16, { duration: 0.6 })
    setFocusPersonId(person.id)
  }, [])

  const flyToInfra = useCallback((item: Infrastructure) => {
    mapRef.current?.flyTo([item.lat, item.lng], 16, { duration: 0.6 })
  }, [])

  const onProvinceChange = useCallback((p: ProvinceId) => {
    setProvince(p)
    mapRef.current?.flyToBounds(PROVINCE_CONFIGS[p].bounds, { duration: 0.7, padding: [40, 40] })
  }, [])

  const onFloodClick = useCallback(() => {
    setRosterFilter('flooded')
    setActivePanel('roster')
  }, [])

  const onNearClick = useCallback(() => {
    setRosterFilter('at_risk')
    setActivePanel('roster')
  }, [])

  const drawRoute = useCallback(
    async (personId: number) => {
      const person = vulnerable.find((p) => p.id === personId)
      if (!person) return
      const shelters = infra.filter(
        (x) =>
          x.type === 'shelter' ||
          x.type === 'assembly' ||
          x.type === 'hospital' ||
          x.type === 'clinic',
      )
      const shelter = nearestShelter(person, shelters)
      if (!shelter) return
      const map = mapRef.current
      if (!map) return
      const L = (await import('leaflet')).default
      if (!routeGroupRef.current) {
        routeGroupRef.current = L.layerGroup().addTo(map)
      }
      const route = await buildEvacRouteOSRM(person, shelter)
      const durationText = route.durationMin != null ? ` · ${route.durationMin} นาที` : ''
      const fallbackNote = route.isStraightLine
        ? '<div style="font-size:10px;color:var(--warn);margin-top:4px">⚠ เส้นตรง (routing ขัดข้อง)</div>'
        : ''
      L.polyline(route.coords as [number, number][], {
        color: 'oklch(0.66 0.20 30)',
        weight: 3.5,
        opacity: 0.95,
        dashArray: route.isStraightLine ? '6, 6' : undefined,
      })
        .bindPopup(
          `<div>
            <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">เส้นทางอพยพ</div>
            <div style="font-size:13px;font-weight:600;margin-bottom:2px">${person.name}</div>
            <div style="font-size:12px;color:var(--fg-muted);margin-bottom:6px">→ ${shelter.name}</div>
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent)">${route.distanceKm} กม.${durationText}</div>
            ${fallbackNote}
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
      <Masthead session={session} />
      <StatusStrip
        waterLevel={summarySnap[province]?.s2?.level ?? waterLevel}
        s1Level={summarySnap[province]?.s1?.level ?? null}
        s1Alert={summarySnap[province]?.s1?.alert ?? 'normal'}
        activeZone={activeZone}
        alertLevel={summarySnap[province]?.s2?.alert ?? alertLevel}
        vulnerable={vulnStats}
        updatedAt={alertUpdatedAt}
        province={province}
        onProvinceChange={onProvinceChange}
        onFloodClick={onFloodClick}
        onNearClick={onNearClick}
      />

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
            activeZone={activeZone}
            initialFilter={rosterFilter}
            onSelect={flyTo}
            onClose={() => { setActivePanel(null); setRosterFilter('all') }}
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
            basemap={basemap === 'hybrid' ? 'sat' : basemap}
            onBasemap={setBasemap}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'water' && (
          <WaterLevelSidebar onClose={() => setActivePanel(null)} />
        )}

        <div id="map-region" role="region" aria-label="แผนที่น้ำท่วม" className="relative flex-1">
          <FloodAlertBanner />
          <MapWrapper
            layers={layers}
            vulnerable={vulnerable}
            infra={infra}
            basemap={basemap}
            floodMarkProvince={floodMarkProvince}
            focusPersonId={focusPersonId}
            userFloodMarks={userFloodMarks}
            pinMode={pinMode}
            onPinPlace={onPinPlace}
            onMapReady={(m) => (mapRef.current = m)}
            onRequestRoute={drawRoute}
          />
          <MapOverlay />
          {canPin && (
            <button
              type="button"
              onClick={() => setPinMode((v) => !v)}
              title={pinMode ? 'คลิกบนแผนที่เพื่อปัก (กดเพื่อยกเลิก)' : 'ปักหมุด Flood Mark'}
              aria-label={pinMode ? 'ยกเลิกการปักหมุด' : 'ปักหมุด Flood Mark'}
              aria-pressed={pinMode}
              className={`pointer-events-auto absolute right-4 top-1/2 z-[401] flex size-10 -translate-y-1/2 items-center justify-center rounded-md border transition-colors md:size-9 ${
                pinMode
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]'
              }`}
            >
              <MapPinPlus size={16} strokeWidth={1.75} />
            </button>
          )}
          {canPin && (
            <UserFloodMarkForm
              draft={pinDraft}
              onCancel={() => setPinDraft(null)}
              onCreated={onMarkCreated}
            />
          )}
        </div>
      </div>
    </div>
  )
}
