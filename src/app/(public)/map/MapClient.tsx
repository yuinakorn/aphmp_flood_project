'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { MapWrapper } from '@/components/map/MapWrapper'
import { Masthead } from '@/components/shell/Masthead'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { StatusStrip } from '@/components/shell/StatusStrip'
import { Rail, type RailPanel } from '@/components/shell/Rail'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { FilterPanel } from '@/components/panels/FilterPanel'
import { RiskZonePanel } from '@/components/panels/RiskZonePanel'
import { RosterPanel } from '@/components/panels/RosterPanel'
import { RoutesPanel } from '@/components/panels/RoutesPanel'
import { InfraPanel } from '@/components/panels/InfraPanel'
import { TunePanel } from '@/components/panels/TunePanel'
import { MapOverlay } from '@/components/map/MapOverlay'
import { WaterLevelSidebar } from '@/components/map/WaterLevelSidebar'
import { CriticalCaseBanner } from '@/components/map/CriticalCaseBanner'
import { UserFloodMarkForm } from '@/components/map/UserFloodMarkForm'
import { MapPinPlus, LocateFixed, Loader2 } from 'lucide-react'
import { buildEvacRouteOSRM, nearestShelter, pointInPolygon } from '@/lib/geo'
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
  VulnerableHouseholdMarker,
  VulnerableStats,
  RiskLevel,
  FloodRiskZone,
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

// แปลงชื่อจังหวัด (ไทย) → ProvinceId ของพื้นที่เฝ้าระวังน้ำ (มี config 4 พื้นที่)
const PROVINCE_NAME_TO_ID: Record<string, ProvinceId> = {
  'เชียงใหม่': 'chiangmai',
  'น่าน': 'nan',
  'เชียงราย': 'chiangrai',
}

interface Props {
  session?: { id: string; role: string; name: string } | null
  canManageStaff?: boolean
  canTriage?: boolean
  userProvince?: string | null
  isNational?: boolean
}

export function MapClient({ session, canManageStaff = false, canTriage = false, userProvince = null, isNational = false }: Props) {
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS)
  const [activePanel, setActivePanel] = useState<RailPanel>('roster')
  const [vulnerable, setVulnerable] = useState<VulnerablePerson[]>([])
  const [households, setHouseholds] = useState<VulnerableHouseholdMarker[]>([])
  const [infra, setInfra] = useState<Infrastructure[]>([])
  const [floodMarkProvinces, setFloodMarkProvinces] = useState<FloodMarkProvince[]>([])
  const [floodMarkProvince, setFloodMarkProvince] = useState<string | null>(null)
  const [userFloodMarks, setUserFloodMarks] = useState<UserFloodMark[]>([])
  const [pinMode, setPinMode] = useState(false)
  const [pinDraft, setPinDraft] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const canPin = !!session && WRITE_ROLES.has(session.role)
  const [waterLevel, setWaterLevel] = useState<number | null>(null)
  const [activeZone, setActiveZone] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('normal')
  const [alertUpdatedAt, setAlertUpdatedAt] = useState<string | null>(null)
  const [summarySnap, setSummarySnap] = useState<Record<string, ProvinceSummarySnap>>({})
  const [province, setProvince] = useState<ProvinceId>(
    (userProvince && PROVINCE_NAME_TO_ID[userProvince]) || 'chiangmai',
  )
  const didFitRef = useRef(false)
  const [rosterFilter, setRosterFilter] = useState<'all' | 'flooded' | 'at_risk'>('all')

  // สถิติกลุ่มเปราะบาง — คิดจากข้อมูลที่ scope จังหวัดแล้ว (ถูกต้องทุกจังหวัด ไม่ผูกกับโซนเชียงใหม่)
  const vulnStats: VulnerableStats = useMemo(() => {
    let flood = 0, near = 0, safe = 0
    for (const p of vulnerable) {
      if (p.risk === 'flood') flood++
      else if (p.risk === 'near') near++
      else safe++
    }
    return { flood, near, safe, total: vulnerable.length }
  }, [vulnerable])

  // ── ตัวกรองหมุดบ้าน (faceted) — เซตว่าง = แสดงทั้งหมด ──
  const [filterRisk, setFilterRisk] = useState<Set<RiskLevel>>(new Set())
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set())
  const [filterTambons, setFilterTambons] = useState<Set<string>>(new Set())

  const toggleIn = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })

  const clearFilters = useCallback(() => {
    setFilterRisk(new Set())
    setFilterGroups(new Set())
    setFilterTambons(new Set())
  }, [])

  // ── โซนเสี่ยงน้ำท่วม (วาดเอง) ──
  const ZONE_EDIT_ROLES = new Set(['admin', 'officer', 'eoc', 'ems', 'ddpm'])
  const canEditZones = !!session && ZONE_EDIT_ROLES.has(session.role)
  const [riskZones, setRiskZones] = useState<FloodRiskZone[]>([])
  const [drawing, setDrawing] = useState(false)
  const [draftZone, setDraftZone] = useState<[number, number][]>([]) // [lat, lng][]

  const loadZones = useCallback(async () => {
    try {
      const res = await fetch('/api/flood-risk-zones', { cache: 'no-store' })
      if (res.ok) setRiskZones(((await res.json()).data ?? []) as FloodRiskZone[])
    } catch { /* เงียบไว้ — โซนเป็นข้อมูลเสริม */ }
  }, [])

  useEffect(() => {
    fetch('/api/flood-risk-zones', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setRiskZones((j.data ?? []) as FloodRiskZone[]))
      .catch(() => {})
  }, [])

  // นับกลุ่มเปราะบาง (รายคน) ในแต่ละโซน ด้วย point-in-polygon
  const zonesWithCount = useMemo(
    () => riskZones.map((z) => ({
      ...z,
      count: vulnerable.filter((p) => pointInPolygon(p.lat, p.lng, z.polygon)).length,
    })),
    [riskZones, vulnerable],
  )

  const startDraw = useCallback(() => {
    setPinMode(false)
    setDraftZone([])
    setDrawing(true)
    setActivePanel('zones')
  }, [])
  const addDraftVertex = useCallback((lat: number, lng: number) => {
    setDraftZone((prev) => [...prev, [lat, lng]])
  }, [])
  const undoDraftVertex = useCallback(() => setDraftZone((prev) => prev.slice(0, -1)), [])
  const cancelDraw = useCallback(() => { setDrawing(false); setDraftZone([]) }, [])
  const saveDraw = useCallback(async (name: string, priority: number): Promise<boolean> => {
    if (draftZone.length < 3) return false
    try {
      const polygon = draftZone.map(([lat, lng]) => [lng, lat]) // เก็บเป็น [lng,lat]
      const res = await fetch('/api/flood-risk-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, priority, polygon }),
      })
      if (!res.ok) return false
      setDrawing(false)
      setDraftZone([])
      await loadZones()
      return true
    } catch { return false }
  }, [draftZone, loadZones])
  const deleteZone = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/flood-risk-zones/${id}`, { method: 'DELETE' })
      if (res.ok) await loadZones()
    } catch { /* noop */ }
  }, [loadZones])
  const zoomZone = useCallback(async (z: FloodRiskZone) => {
    const map = mapRef.current
    if (!map || z.polygon.length < 3) return
    const L = (await import('leaflet')).default
    map.fitBounds(L.latLngBounds(z.polygon.map(([lng, lat]) => [lat, lng] as [number, number])), { padding: [50, 50] })
  }, [])

  const filteredHouseholds = useMemo(() => {
    if (filterRisk.size === 0 && filterGroups.size === 0 && filterTambons.size === 0) return households
    return households.filter((h) => {
      if (filterRisk.size > 0 && !filterRisk.has((h.risk ?? 'safe') as RiskLevel)) return false
      if (filterTambons.size > 0 && !(h.tambon && filterTambons.has(h.tambon))) return false
      if (filterGroups.size > 0 && !h.members.some((m) => (m.categories ?? []).some((c) => filterGroups.has(c)))) return false
      return true
    })
  }, [households, filterRisk, filterGroups, filterTambons])

  // ผู้ป่วยกลุ่มวิกฤต (priority A) ที่อยู่ในเขตน้ำท่วม — ใช้ขึ้นแถบเตือนเชิงปฏิบัติการ
  const criticalCount = useMemo(
    () => vulnerable.filter((p) => p.risk === 'flood' && p.medicalPriority === 'A').length,
    [vulnerable],
  )

  const [basemap, setBasemap] = useState<BasemapType>('google')

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
      fetch('/api/infra')
        .then((r) => {
          if (!r.ok) throw new Error(`API error: ${r.status}`)
          return r.json()
        })
        .then((json) => json.data ?? [])
        .catch((e) => {
          console.error('Failed to load infrastructure:', e)
          return []
        }),
      fetch('/api/family-folder/map')
        .then((r) => {
          if (!r.ok) throw new Error(`API error: ${r.status}`)
          return r.json()
        })
        .catch((e) => {
          console.error('Failed to load vulnerable households:', e)
          return []
        }),
    ]).then(([v, i, h]) => {
      setVulnerable(Array.isArray(v) ? v : [])
      setInfra(Array.isArray(i) ? i : [])
      setHouseholds(Array.isArray(h) ? h : [])
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
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`)
        return r.text()
      })
      .then((txt) => {
        if (!txt) return []
        try {
          return JSON.parse(txt)
        } catch (e) {
          console.error('Malformed JSON from /api/user-flood-marks:', e)
          return []
        }
      })
      .then((data) => {
        if (Array.isArray(data)) setUserFloodMarks(data as UserFloodMark[])
      })
      .catch((e) => {
        console.error('Failed to load user flood marks:', e)
      })
  }, [])

  // Keyboard shortcuts: L/R/E/I/T toggle panels; Esc closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (e.key === 'Escape') return setActivePanel(null)
      const key = e.key.toLowerCase()
      const map: Record<string, RailPanel> = {
        l: 'layers',
        f: 'filter',
        r: 'roster',
        z: 'zones',
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

  // เลื่อนแผนที่ไปยังหมุด — บนมือถือดันหมุดขึ้นให้พ้น bottom sheet ที่บังด้านล่าง
  const revealDraftOnMap = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current
    if (!map) return
    const isMobile = window.matchMedia('(max-width: 639px)').matches
    const z = zoom ?? map.getZoom()
    if (isMobile) {
      const p = map.project([lat, lng], z)
      p.y += map.getSize().y * 0.32
      map.flyTo(map.unproject(p, z), z, { duration: 0.7 })
    } else {
      map.flyTo([lat, lng], z, { duration: 0.7 })
    }
  }, [])

  const onPinPlace = useCallback(
    (lat: number, lng: number) => {
      setPinDraft({ lat, lng })
      setPinMode(false)
      // เดสก์ท็อปไม่ต้องเลื่อน (ฟอร์มอยู่ขวา ไม่บังจุดที่คลิก); มือถือเลื่อนให้พ้น sheet
      if (window.matchMedia('(max-width: 639px)').matches) revealDraftOnMap(lat, lng)
    },
    [revealDraftOnMap],
  )

  const onPinDragEnd = useCallback((lat: number, lng: number) => {
    setPinDraft({ lat, lng })
  }, [])

  // ปักหมุดจากพิกัด GPS ของอุปกรณ์จริง — สำหรับผู้ใช้งานลงพื้นที่
  const onUseMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      window.alert('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const { latitude, longitude } = pos.coords
        setPinMode(false)
        setPinDraft({ lat: latitude, lng: longitude })
        revealDraftOnMap(latitude, longitude, 17)
      },
      (err) => {
        setLocating(false)
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — โปรดเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'ไม่สามารถระบุตำแหน่งได้ในขณะนี้'
              : 'ระบุตำแหน่งใช้เวลานานเกินไป ลองอีกครั้ง'
        window.alert(msg)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [revealDraftOnMap])

  const onMarkCreated = useCallback((mark: UserFloodMark) => {
    setUserFloodMarks((prev) => [mark, ...prev])
    setPinDraft(null)
    setLayers((p) => ({ ...p, userFloodMarks: true }))
  }, [])

  const onDeleteMark = useCallback(async (id: string) => {
    if (!window.confirm('ลบหมุด Flood Mark นี้?')) return
    try {
      const res = await fetch(`/api/user-flood-marks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUserFloodMarks((prev) => prev.filter((m) => m.id !== id))
        mapRef.current?.closePopup()
      } else {
        const b = await res.json().catch(() => null)
        window.alert(b?.error ?? `ลบไม่สำเร็จ (${res.status})`)
      }
    } catch {
      window.alert('เครือข่ายขัดข้อง ลองอีกครั้ง')
    }
  }, [])

  const flyTo = useCallback((person: VulnerablePerson) => {
    mapRef.current?.flyTo([person.lat, person.lng], 16, { duration: 0.6 })
  }, [])

  const flyToInfra = useCallback((item: Infrastructure) => {
    mapRef.current?.flyTo([Number(item.lat), Number(item.lng)], 16, { duration: 0.6 })
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

  // เส้นทางอพยพจากบ้าน (พิกัดครัวเรือน) → ศูนย์อพยพ/หน่วยบริการที่ใกล้สุด
  const drawHouseRoute = useCallback(
    async (lat: number, lng: number, label: string) => {
      const shelters = infra.filter(
        (x) =>
          x.type === 'shelter' ||
          x.type === 'assembly' ||
          x.type === 'hospital' ||
          x.type === 'clinic',
      )
      const origin = { lat, lng, name: label } as VulnerablePerson
      const shelter = nearestShelter(origin, shelters)
      if (!shelter) return
      const map = mapRef.current
      if (!map) return
      const L = (await import('leaflet')).default
      if (!routeGroupRef.current) {
        routeGroupRef.current = L.layerGroup().addTo(map)
      }
      const route = await buildEvacRouteOSRM(origin, shelter)
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
            <div style="font-size:13px;font-weight:600;margin-bottom:2px">${label}</div>
            <div style="font-size:12px;color:var(--fg-muted);margin-bottom:6px">→ ${shelter.name}</div>
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent)">${route.distanceKm} กม.${durationText}</div>
            ${fallbackNote}
          </div>`,
        )
        .addTo(routeGroupRef.current)
    },
    [infra],
  )

  const clearRoutes = useCallback(() => {
    routeGroupRef.current?.clearLayers()
  }, [])

  // จัดมุมมองแผนที่ให้พอดีกับข้อมูลจังหวัดของผู้ใช้ (non-national) — ครั้งเดียวตอนโหลดเสร็จ
  useEffect(() => {
    if (didFitRef.current || isNational) return
    const map = mapRef.current
    if (!map) return // ข้อมูลโหลดช้ากว่าแผนที่ mount เสมอ — map พร้อมแล้วตอน households มาถึง
    const pts: [number, number][] = [
      ...households.map((h) => [h.lat, h.lng] as [number, number]),
      ...infra.map((i) => [Number(i.lat), Number(i.lng)] as [number, number]),
    ].filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln))
    if (pts.length === 0) return
    didFitRef.current = true
    ;(async () => {
      const L = (await import('leaflet')).default
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 13 })
    })()
  }, [households, infra, isNational])

  // สั่งอพยพจาก popup บ้าน → สร้างคำขอช่วยเหลือ (evacuation) เข้าสู่คิว EOC/ทีมภาคสนาม
  const requestEvacuation = useCallback(async (h: VulnerableHouseholdMarker): Promise<boolean> => {
    try {
      const addr = [
        h.hno ? `บ้านเลขที่ ${h.hno}` : null,
        h.village,
        h.villno ? `หมู่ ${h.villno}` : null,
        h.tambon,
        h.amphoe,
      ].filter(Boolean).join(' ')
      const res = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'evacuation',
          priority: h.risk === 'flood' ? 'high' : 'normal',
          lat: h.lat,
          lng: h.lng,
          description: `สั่งอพยพจากแผนที่ · ${addr} · กลุ่มเปราะบาง ${h.vulnerableCount} คน`,
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <a href="#map-region" className="skip-to-map">
        ข้ามไปที่แผนที่
      </a>
      <Masthead session={session} />
      <div className="flex flex-1 overflow-hidden">
      <AppSidebar canManageStaff={canManageStaff} canTriage={canTriage} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
        lockProvince={!isNational}
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
        {activePanel === 'filter' && (
          <FilterPanel
            households={households}
            filterRisk={filterRisk}
            filterGroups={filterGroups}
            filterTambons={filterTambons}
            onToggleRisk={(v) => toggleIn(setFilterRisk, v)}
            onToggleGroup={(v) => toggleIn(setFilterGroups, v)}
            onToggleTambon={(v) => toggleIn(setFilterTambons, v)}
            onClear={clearFilters}
            resultCount={filteredHouseholds.length}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'zones' && (
          <RiskZonePanel
            zones={zonesWithCount}
            canEdit={canEditZones}
            drawing={drawing}
            draftCount={draftZone.length}
            onStartDraw={startDraw}
            onUndoVertex={undoDraftVertex}
            onCancelDraw={cancelDraw}
            onSaveDraw={saveDraw}
            onDelete={deleteZone}
            onZoomZone={zoomZone}
            onClose={() => { if (!drawing) setActivePanel(null) }}
          />
        )}
        {activePanel === 'roster' && (
          <RosterPanel
            persons={vulnerable}
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
          <CriticalCaseBanner
            count={criticalCount}
            onView={() => { setRosterFilter('flooded'); setActivePanel('roster') }}
          />
          <MapWrapper
            layers={layers}
            households={filteredHouseholds}
            infra={infra}
            basemap={basemap}
            floodMarkProvince={floodMarkProvince}
            userFloodMarks={userFloodMarks}
            pinMode={pinMode}
            onPinPlace={onPinPlace}
            pinDraft={pinDraft}
            onPinDragEnd={onPinDragEnd}
            sessionUserId={session?.id ?? null}
            sessionRole={session?.role ?? null}
            onDeleteMark={onDeleteMark}
            // เก็บ map instance ไว้ใช้ fly/fit — pattern มาตรฐาน, ref นี้ตั้งใจ mutate
            // eslint-disable-next-line react-hooks/immutability
            onMapReady={(m) => { mapRef.current = m }}
            onRequestHouseRoute={drawHouseRoute}
            canRequestEvac={canPin}
            onRequestEvacuation={requestEvacuation}
            riskZones={riskZones}
            drawMode={drawing}
            draftZone={draftZone}
            onDrawVertex={addDraftVertex}
          />
          <MapOverlay />
          {canPin && (
            <div className="pointer-events-none absolute right-4 top-1/2 z-[401] flex -translate-y-1/2 flex-col gap-2">
              <button
                type="button"
                onClick={() => setPinMode((v) => !v)}
                title={pinMode ? 'คลิกบนแผนที่เพื่อปัก (กดเพื่อยกเลิก)' : 'ปักหมุด Flood Mark'}
                aria-label={pinMode ? 'ยกเลิกการปักหมุด' : 'ปักหมุด Flood Mark'}
                aria-pressed={pinMode}
                className={`pointer-events-auto flex size-10 items-center justify-center rounded-md border transition-colors md:size-9 ${
                  pinMode
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]'
                }`}
              >
                <MapPinPlus size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={onUseMyLocation}
                disabled={locating}
                title="ปักหมุดจากตำแหน่งปัจจุบัน (GPS)"
                aria-label="ปักหมุดจากตำแหน่งปัจจุบัน"
                className="pointer-events-auto flex size-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-60 md:size-9"
              >
                {locating ? (
                  <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
                ) : (
                  <LocateFixed size={16} strokeWidth={1.75} />
                )}
              </button>
            </div>
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
      </div>
    </div>
  )
}
