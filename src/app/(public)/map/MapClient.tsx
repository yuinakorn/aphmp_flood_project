'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Map as LeafletMap, LayerGroup } from 'leaflet'
import { MapWrapper } from '@/components/map/MapWrapper'
import { Masthead } from '@/components/shell/Masthead'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { StatusStrip } from '@/components/shell/StatusStrip'
import { Rail, type RailPanel } from '@/components/shell/Rail'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'
import { memberMatchesAreas } from '@/lib/incident-area-match'
import { LayersPanel } from '@/components/panels/LayersPanel'
import { FilterPanel } from '@/components/panels/FilterPanel'
import { RiskZonePanel, type SaveZoneInput } from '@/components/panels/RiskZonePanel'
import type { HazardTypeDef } from '@/lib/risk-zone'
import { RosterPanel } from '@/components/panels/RosterPanel'
import { RoutesPanel } from '@/components/panels/RoutesPanel'
import { InfraPanel } from '@/components/panels/InfraPanel'
import { CrFloodRosterPanel } from '@/components/panels/CrFloodRosterPanel'
import { TunePanel } from '@/components/panels/TunePanel'
import { MapOverlay } from '@/components/map/MapOverlay'
import { WaterLevelSidebar } from '@/components/map/WaterLevelSidebar'
import { CriticalCaseBanner } from '@/components/map/CriticalCaseBanner'
import { UserFloodMarkForm } from '@/components/map/UserFloodMarkForm'
import { EvacPointForm } from '@/components/map/EvacPointForm'
import { MapPinPlus, LocateFixed, Loader2, Ambulance } from 'lucide-react'
import { buildEvacRouteOSRM, nearestShelter, pointInPolygon } from '@/lib/geo'
import type { AlertLevel, ProvinceId } from '@/lib/water-level'
import { PROVINCE_CONFIGS } from '@/lib/water-level'

type StationSnap = { level: number | null; alert: AlertLevel }
type ProvinceSummarySnap = { s1: StationSnap; s2: StationSnap }
import type { FloodAlertResponse } from '@/app/api/cmu-flood-alert/route'
import type {
  BasemapType,
  CmuFloodLayerKey,
  CrFloodLayerKey,
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
import { CR_FLOOD_LAYERS } from '@/types'
import type { CrFloodAnalysis, CrFloodDepthHit } from '@/lib/geo'
import { analyzeCrFloodHouseholds } from '@/lib/geo'
import type { FeatureCollection } from 'geojson'

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
  crFlood: {
    cr_cei: false,
    cr_detail: false,
    cr_flow1500: false,
    cr_flow2000: false,
    ms_coarse: false,
    ms_detail: false,
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

// แปลงอำเภอ (ไทย) → ProvinceId เพื่อ align พาเนลระดับน้ำ/โซนให้ตรงพื้นที่เหตุการณ์
// (จังหวัดเดียวกันมีได้หลายพื้นที่เฝ้าระวัง เช่น เชียงราย: เมือง vs แม่สาย)
const AMPHOE_NAME_TO_ID: Record<string, ProvinceId> = {
  'เมืองเชียงราย': 'chiangrai',
  'แม่สาย': 'chiangrai_maesai',
}

// ProvinceId → ชื่อจังหวัด (ไทย) สำหรับบันทึกโซน (national role ต้องส่ง province เอง)
const ID_TO_PROVINCE_NAME: Record<ProvinceId, string> = {
  chiangmai: 'เชียงใหม่',
  nan: 'น่าน',
  chiangrai: 'เชียงราย',
  chiangrai_maesai: 'เชียงราย',
}

/** เลือก ProvinceId ของพื้นที่เฝ้าระวังน้ำที่ตรงกับพื้นที่หลักของเหตุการณ์ (อำเภอก่อน แล้วค่อย fallback จังหวัด) */
function incidentToProvinceId(
  areas: { province?: string | null; amphoe?: string | null }[] | undefined,
): ProvinceId | null {
  for (const a of areas ?? []) {
    if (a.amphoe && AMPHOE_NAME_TO_ID[a.amphoe]) return AMPHOE_NAME_TO_ID[a.amphoe]
  }
  for (const a of areas ?? []) {
    if (a.province && PROVINCE_NAME_TO_ID[a.province]) return PROVINCE_NAME_TO_ID[a.province]
  }
  return null
}

// กรอบพิกัดโดยประมาณของ 8 จังหวัดเหนือ [[south, west], [north, east]] — ใช้โฟกัสแผนที่ตามจังหวัด login
const PROVINCE_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  'เชียงใหม่': [[17.0, 98.0], [20.2, 99.7]],
  'เชียงราย': [[19.0, 99.2], [20.5, 100.7]],
  'น่าน': [[17.7, 100.1], [19.4, 101.4]],
  'พะเยา': [[18.7, 99.7], [19.8, 100.6]],
  'ลำพูน': [[17.5, 98.5], [18.7, 99.5]],
  'แม่ฮ่องสอน': [[17.9, 97.3], [19.8, 98.7]],
  'ลำปาง': [[17.2, 98.9], [19.4, 100.3]],
  'แพร่': [[17.7, 99.6], [18.9, 100.5]],
}

interface Props {
  session?: { id: string; role: string; name: string } | null
  visibleKeys?: string[]
  userProvince?: string | null
  isNational?: boolean
}

export function MapClient({ session, visibleKeys = [], userProvince = null, isNational = false }: Props) {
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
  const crFloodGeoCacheRef = useRef<Partial<Record<CrFloodLayerKey, FeatureCollection>>>({})
  const [crFloodAnalysis, setCrFloodAnalysis] = useState<Partial<Record<CrFloodLayerKey, CrFloodAnalysis>>>({})
  const [activeZone, setActiveZone] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('normal')
  const [alertUpdatedAt, setAlertUpdatedAt] = useState<string | null>(null)
  const [summarySnap, setSummarySnap] = useState<Record<string, ProvinceSummarySnap>>({})
  const [province, setProvince] = useState<ProvinceId>(
    (userProvince && PROVINCE_NAME_TO_ID[userProvince]) || 'chiangmai',
  )
  // โหมดวิกฤต: เหตุการณ์ที่กำลังจัดการ — null = โหมดปกติ (ใช้ dropdown จังหวัดตามเดิม)
  const { active: activeIncident } = useIncidentScope()
  // พื้นที่ผลกระทบจริงของเหตุการณ์ (multi-อำเภอ/ตำบล) — ใช้ scope ข้อมูลแทน dropdown เมื่อมีเหตุการณ์
  // ถ้าไม่มีแถว incident_areas แต่เหตุการณ์ระบุพื้นที่หลักไว้ → ใช้พื้นที่หลักเป็น scope (กันข้อมูลข้ามเหตุการณ์)
  const activeAreas = useMemo(() => {
    if (!activeIncident) return null
    if (activeIncident.areas?.length) return activeIncident.areas
    if (activeIncident.province || activeIncident.amphoe || activeIncident.tambon) {
      return [{ province: activeIncident.province, amphoe: activeIncident.amphoe, tambon: activeIncident.tambon }]
    }
    return null
  }, [activeIncident])
  // พื้นที่เฝ้าระวังน้ำที่ตรงกับเหตุการณ์ (null = เหตุการณ์อยู่นอก config ระดับน้ำ → คงข้อมูลที่ scope ด้วย activeAreas)
  const incidentProvinceId = activeIncident
    ? incidentToProvinceId(activeIncident.areas ?? [activeIncident])
    : null
  // โหมดวิกฤต → พาเนลระดับน้ำ/โซน/ป้ายพื้นที่ ยึดตามเหตุการณ์; โหมดปกติ → ตาม dropdown ที่ผู้ใช้เลือก
  const effectiveProvince = incidentProvinceId ?? province

  // จังหวัด (ไทย) ที่อยู่ในขอบเขตเหตุการณ์ — โหมดวิกฤตยึด incident_areas (รองรับหลายจังหวัด),
  // โหมดปกติยึด dropdown จังหวัดที่เลือก เพื่อไม่ให้เห็นโซนข้ามจังหวัด/ข้ามเหตุการณ์
  const scopedZoneProvinces = useMemo(() => {
    if (activeAreas) {
      const set = new Set<string>()
      for (const a of activeAreas) if (a.province) set.add(a.province)
      return set
    }
    const name = ID_TO_PROVINCE_NAME[province]
    return name ? new Set([name]) : new Set<string>()
  }, [activeAreas, province])
  const didFitRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [rosterFilter, setRosterFilter] = useState<'all' | 'flooded' | 'at_risk'>('all')
  const [focusHouseholdId, setFocusHouseholdId] = useState<string | null>(null)

  const provinceVulnerable = useMemo(() => {
    // โหมดวิกฤต → ยึดพื้นที่ตามเหตุการณ์ (incident_areas) ไม่ปนข้ามเหตุการณ์ในจังหวัดเดียวกัน
    if (activeAreas) return vulnerable.filter((p) => memberMatchesAreas(p, activeAreas))
    return vulnerable.filter((p) => {
      if (province === 'chiangmai') return p.province === 'เชียงใหม่'
      if (province === 'nan') return p.province === 'น่าน'
      if (province === 'chiangrai') return p.province === 'เชียงราย' && p.amphoe === 'เมืองเชียงราย'
      if (province === 'chiangrai_maesai') return p.province === 'เชียงราย' && p.amphoe === 'แม่สาย'
      return false
    })
  }, [vulnerable, province, activeAreas])

  const provinceHouseholds = useMemo(() => {
    if (activeAreas) return households.filter((h) => memberMatchesAreas(h, activeAreas))
    return households.filter((h) => {
      if (province === 'chiangmai') return h.province === 'เชียงใหม่'
      if (province === 'nan') return h.province === 'น่าน'
      if (province === 'chiangrai') return h.province === 'เชียงราย' && h.amphoe === 'เมืองเชียงราย'
      if (province === 'chiangrai_maesai') return h.province === 'เชียงราย' && h.amphoe === 'แม่สาย'
      return false
    })
  }, [households, province, activeAreas])

  // สถิติกลุ่มเปราะบาง — คิดจากข้อมูลที่ scope จังหวัดแล้ว (ถูกต้องทุกจังหวัด ไม่ผูกกับโซนเชียงใหม่)
  const vulnStats: VulnerableStats = useMemo(() => {
    let flood = 0, near = 0, safe = 0
    for (const p of provinceVulnerable) {
      if (p.isAdmitted) {
        safe++
      } else if (p.risk === 'flood') {
        flood++
      } else if (p.risk === 'near') {
        near++
      } else {
        safe++
      }
    }
    return { flood, near, safe, total: provinceVulnerable.length }
  }, [provinceVulnerable])

  // ── ตัวกรองหมุดบ้าน (faceted) — เซตว่าง = แสดงทั้งหมด ──
  const [filterRisk, setFilterRisk] = useState<Set<RiskLevel>>(new Set())
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set())
  const [filterTambons, setFilterTambons] = useState<Set<string>>(new Set())
  const [filterPriority, setFilterPriority] = useState<Set<string>>(new Set())
  const [filterLifeSupport, setFilterLifeSupport] = useState<Set<string>>(new Set())
  const [filterShelter, setFilterShelter] = useState<Set<string>>(new Set())

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
    setFilterPriority(new Set())
    setFilterLifeSupport(new Set())
    setFilterShelter(new Set())
  }, [])

  // ── โซนเสี่ยงน้ำท่วม (วาดเอง) ──
  const ZONE_EDIT_ROLES = new Set(['admin', 'officer', 'eoc', 'ems', 'ddpm'])
  const canEditZones = !!session && ZONE_EDIT_ROLES.has(session.role)
  const [riskZones, setRiskZones] = useState<FloodRiskZone[]>([])
  const [hazardTypes, setHazardTypes] = useState<HazardTypeDef[]>([])
  const [drawing, setDrawing] = useState(false)
  const [draftZone, setDraftZone] = useState<[number, number][]>([]) // [lat, lng][]
  const [editingZone, setEditingZone] = useState<FloodRiskZone | null>(null) // null = วาดใหม่

  // ทะเบียนชนิดภัย (ตั้งค่าได้ที่ /admin/settings/hazard-types) — ใช้เป็นตัวเลือกในฟอร์มวาดโซน
  useEffect(() => {
    let cancelled = false
    fetch('/api/hazard-types?active=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { if (!cancelled) setHazardTypes((j.data ?? []) as HazardTypeDef[]) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // คิวรีจังหวัดที่ scope ไว้ — กรองตั้งแต่ต้นทาง (API) ไม่ดึงโซนข้ามจังหวัด/ข้ามเหตุการณ์มา
  const zonesQuery = useMemo(() => {
    const provinces = [...scopedZoneProvinces]
    return provinces.length ? `?provinces=${provinces.map(encodeURIComponent).join(',')}` : ''
  }, [scopedZoneProvinces])

  const loadZones = useCallback(async () => {
    try {
      const res = await fetch(`/api/flood-risk-zones${zonesQuery}`, { cache: 'no-store' })
      if (res.ok) setRiskZones(((await res.json()).data ?? []) as FloodRiskZone[])
    } catch { /* เงียบไว้ — โซนเป็นข้อมูลเสริม */ }
  }, [zonesQuery])

  // โหลดโซนเมื่อ scope จังหวัดเปลี่ยน (เปลี่ยนเหตุการณ์/จังหวัด) — กัน race ด้วย cancelled flag
  useEffect(() => {
    let cancelled = false
    fetch(`/api/flood-risk-zones${zonesQuery}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { if (!cancelled) setRiskZones((j.data ?? []) as FloodRiskZone[]) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [zonesQuery])

  // นับกลุ่มเปราะบางในแต่ละโซน — ใช้ชุดเดียวกับหมุดบนแผนที่ (sum vulnerableCount ของบ้านในโซน)
  // เพื่อให้ตรงกับ badge ที่ผู้ใช้เห็น (ไม่ใช้ /api/vulnerable ที่เกณฑ์ต่างกัน)
  const zonesWithCount = useMemo(
    () => riskZones
      .filter((z) => scopedZoneProvinces.has(z.province))
      .map((z) => ({
        ...z,
        count: provinceHouseholds.reduce(
          (sum, h) => sum + (pointInPolygon(h.lat, h.lng, z.polygon) ? h.vulnerableCount : 0),
          0,
        ),
      })),
    [riskZones, provinceHouseholds, scopedZoneProvinces],
  )

  const startDraw = useCallback(() => {
    setPinMode(false)
    setEditingZone(null)
    setDraftZone([])
    setDrawing(true)
    setActivePanel('zones')
  }, [])
  // แก้ไขโซนเดิม — โหลด polygon ([lng,lat]→[lat,lng]) ลง draft แล้วเข้าโหมดแก้ไข (prefill ฟอร์มผ่าน key remount)
  const startEdit = useCallback((z: FloodRiskZone) => {
    setPinMode(false)
    setEditingZone(z)
    setDraftZone(z.polygon.map(([lng, lat]) => [lat, lng] as [number, number]))
    setDrawing(true)
    setActivePanel('zones')
  }, [])
  const addDraftVertex = useCallback((lat: number, lng: number) => {
    setDraftZone((prev) => [...prev, [lat, lng]])
  }, [])
  const undoDraftVertex = useCallback(() => setDraftZone((prev) => prev.slice(0, -1)), [])
  const moveDraftVertex = useCallback((index: number, lat: number, lng: number) => {
    setDraftZone((prev) => prev.map((p, i) => (i === index ? [lat, lng] : p)))
  }, [])
  const removeDraftVertex = useCallback((index: number) => {
    setDraftZone((prev) => (prev.length > 3 ? prev.filter((_, i) => i !== index) : prev))
  }, [])
  const cancelDraw = useCallback(() => { setDrawing(false); setDraftZone([]); setEditingZone(null) }, [])
  const saveDraw = useCallback(async (input: SaveZoneInput): Promise<boolean> => {
    if (draftZone.length < 3) return false
    try {
      const polygon = draftZone.map(([lat, lng]) => [lng, lat]) // เก็บเป็น [lng,lat]
      const res = editingZone
        ? await fetch(`/api/flood-risk-zones/${editingZone.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...input, polygon }),
          })
        : await fetch('/api/flood-risk-zones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // national: ส่งชื่อจังหวัด (ไทย) ของพื้นที่ที่กำลังดู · non-national: server ล็อกจังหวัดสังกัดเอง
            body: JSON.stringify({ ...input, polygon, province: ID_TO_PROVINCE_NAME[effectiveProvince] ?? null }),
          })
      if (!res.ok) return false
      setDrawing(false)
      setDraftZone([])
      setEditingZone(null)
      await loadZones()
      return true
    } catch { return false }
  }, [draftZone, loadZones, effectiveProvince, editingZone])
  const deleteZone = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/flood-risk-zones/${id}`, { method: 'DELETE' })
      if (res.ok) await loadZones()
    } catch { /* noop */ }
  }, [loadZones])
  // ── จุดรับ-ส่งอพยพ ──
  const [evacPinMode, setEvacPinMode] = useState(false)
  const [evacDraft, setEvacDraft] = useState<{ lat: number; lng: number } | null>(null)

  const reloadInfra = useCallback(async () => {
    try {
      const res = await fetch('/api/infra', { cache: 'no-store' })
      if (res.ok) setInfra(((await res.json()).data ?? []) as Infrastructure[])
    } catch { /* noop */ }
  }, [])

  const onEvacPlace = useCallback((lat: number, lng: number) => {
    setEvacDraft({ lat, lng })
    setEvacPinMode(false)
  }, [])

  const zoomZone = useCallback(async (z: FloodRiskZone) => {
    const map = mapRef.current
    if (!map || z.polygon.length < 3) return
    const L = (await import('leaflet')).default
    map.fitBounds(L.latLngBounds(z.polygon.map(([lng, lat]) => [lat, lng] as [number, number])), { padding: [50, 50] })
  }, [])

  const filteredHouseholds = useMemo(() => {
    const noFilters = filterRisk.size === 0 && filterGroups.size === 0 && filterTambons.size === 0
      && filterPriority.size === 0 && filterLifeSupport.size === 0 && filterShelter.size === 0
    if (noFilters) return provinceHouseholds
    return provinceHouseholds.filter((h) => {
      if (filterRisk.size > 0 && !filterRisk.has((h.risk ?? 'safe') as RiskLevel)) return false
      if (filterTambons.size > 0 && !(h.tambon && filterTambons.has(h.tambon))) return false
      if (filterGroups.size > 0 && !h.members.some((m) => (m.categories ?? []).some((c) => filterGroups.has(c)))) return false
      if (filterPriority.size > 0 && !h.members.some((m) => m.medicalPriority && filterPriority.has(m.medicalPriority))) return false
      if (filterLifeSupport.size > 0 && !h.members.some((m) => (m.lifeSupport ?? []).some((ls) => filterLifeSupport.has(ls)))) return false
      if (filterShelter.size > 0) {
        const matchShelter =
          (filterShelter.has('at_shelter') && h.members.some((m) => m.shelterId)) ||
          (filterShelter.has('at_home') && h.members.some((m) => !m.shelterId))
        if (!matchShelter) return false
      }
      return true
    })
  }, [provinceHouseholds, filterRisk, filterGroups, filterTambons, filterPriority, filterLifeSupport, filterShelter])

  // ผู้ป่วยกลุ่มวิกฤต (priority A) ที่อยู่ในเขตน้ำท่วม และยังไม่อพยพเข้าศูนย์ — ใช้ขึ้นแถบเตือนเชิงปฏิบัติการ
  const criticalCount = useMemo(
    () => provinceVulnerable.filter((p) => p.risk === 'flood' && p.medicalPriority === 'A' && !p.isAdmitted).length,
    [provinceVulnerable],
  )

  const [basemap, setBasemap] = useState<BasemapType>('sat')

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

  const onCrFloodChange = useCallback((k: CrFloodLayerKey, v: boolean) => {
    setLayers((p) => ({ ...p, crFlood: { ...p.crFlood, [k]: v } }))
  }, [])

  const flyToHousehold = useCallback((h: VulnerableHouseholdMarker) => {
    mapRef.current?.flyTo([h.lat, h.lng], 17, { duration: 0.8 })
    setActivePanel(null)
  }, [])

  // โหลด GeoJSON + วิเคราะห์ว่า household ไหนอยู่ในโซนน้ำท่วมจากแบบจำลอง
  useEffect(() => {
    const activeLayers = CR_FLOOD_LAYERS.filter(cfg => layers.crFlood[cfg.key])
    if (activeLayers.length === 0 || provinceHouseholds.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const cfg of activeLayers) {
        if (cancelled) return
        if (!crFloodGeoCacheRef.current[cfg.key]) {
          try {
            const res = await fetch(`/data/cr_geo/${cfg.file}`)
            if (!res.ok) continue
            const geo = (await res.json()) as FeatureCollection
            if (cancelled) return
            crFloodGeoCacheRef.current[cfg.key] = geo
          } catch {
            continue
          }
        }
        const geo = crFloodGeoCacheRef.current[cfg.key]!
        // yield ให้ browser วาด frame ก่อน แล้วค่อย compute
        await new Promise(r => setTimeout(r, 0))
        if (cancelled) return
        const analysis = analyzeCrFloodHouseholds(provinceHouseholds, geo)
        if (cancelled) return
        setCrFloodAnalysis(prev => ({ ...prev, [cfg.key]: analysis }))
      }
    })()

    return () => { cancelled = true }
  }, [layers.crFlood, provinceHouseholds])

  // รวม hitMap จากทุก layer ที่เปิดอยู่ — เอาระดับน้ำลึกที่สุดต่อ household
  const crFloodHitMap = useMemo(() => {
    const merged = new Map<string, CrFloodDepthHit>()
    for (const cfg of CR_FLOOD_LAYERS) {
      if (!layers.crFlood[cfg.key]) continue
      const analysis = crFloodAnalysis[cfg.key]
      if (!analysis) continue
      for (const [id, hit] of analysis.hitMap.entries()) {
        const existing = merged.get(id)
        if (!existing || hit.level > existing.level) merged.set(id, hit)
      }
    }
    return merged.size > 0 ? merged : undefined
  }, [crFloodAnalysis, layers.crFlood])

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
    // หา household ที่ตรงกัน — ใช้ householdId เป็นหลัก, fallback หาบ้านใกล้สุดจากพิกัด
    let hh: VulnerableHouseholdMarker | undefined
    if (person.householdId) {
      hh = households.find((h) => h.id === person.householdId)
    }
    if (!hh) {
      // fallback: หาบ้านที่ใกล้พิกัดคนที่สุด (ภายใน ~50m)
      let bestDist = Infinity
      for (const h of households) {
        const d = Math.abs(h.lat - person.lat) + Math.abs(h.lng - person.lng)
        if (d < bestDist) { bestDist = d; hh = h }
      }
      // ถ้าบ้านใกล้สุดห่างเกินไป (>~500m) ถือว่าไม่ match
      if (bestDist > 0.005) hh = undefined
    }

    setFocusHouseholdId(null)          // reset ก่อน เพื่อให้ effect ทำงานแม้เลือกคนเดิมซ้ำ
    // fly ไปที่พิกัดของหมุดบ้าน (ไม่ใช่พิกัดของตัวบุคคลที่อาจ jitter ต่างกัน)
    const targetLat = hh?.lat ?? person.lat
    const targetLng = hh?.lng ?? person.lng
    mapRef.current?.flyTo([targetLat, targetLng], 17, { duration: 0.6 })
    // ตั้ง focusHouseholdId หลัง frame ถัดไปเพื่อให้ FloodMap เห็น null → id (trigger effect)
    requestAnimationFrame(() => setFocusHouseholdId(hh?.id ?? null))
  }, [households])

  const flyToInfra = useCallback((item: Infrastructure) => {
    mapRef.current?.flyTo([Number(item.lat), Number(item.lng)], 16, { duration: 0.6 })
  }, [])

  const onProvinceChange = useCallback((p: ProvinceId) => {
    setProvince(p)
    mapRef.current?.flyToBounds(PROVINCE_CONFIGS[p].bounds, { duration: 0.7, padding: [40, 40] })
  }, [])

  // โหมดวิกฤต: บินแผนที่ไปกรอบพื้นที่เหตุการณ์ครั้งเดียวเมื่อเปลี่ยนเหตุการณ์ (ไม่ setState ในเอฟเฟกต์)
  useEffect(() => {
    if (!incidentProvinceId) return
    mapRef.current?.flyToBounds(PROVINCE_CONFIGS[incidentProvinceId].bounds, { duration: 0.7, padding: [40, 40] })
  }, [activeIncident?.id, incidentProvinceId])

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
      const person = provinceVulnerable.find((p) => p.id === personId)
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
    [provinceVulnerable, infra],
  )

  const routeAll = useCallback(async () => {
    routeGroupRef.current?.clearLayers()
    for (const p of provinceVulnerable) {
      if (p.risk === 'flood' || p.risk === 'near') {
        await drawRoute(p.id)
      }
    }
  }, [provinceVulnerable, drawRoute])

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

  // โฟกัสแผนที่ตามจังหวัดที่ผู้ใช้ login (non-national) — ครั้งเดียวตอนแผนที่พร้อม
  // ใช้กรอบจังหวัดเป็นหลัก (แน่นอน ไม่ขึ้นกับความหนาแน่นข้อมูล) · ถ้าไม่มีกรอบ fallback ไป fit ตามข้อมูล
  useEffect(() => {
    if (didFitRef.current || isNational) return
    const map = mapRef.current
    if (!mapReady || !map) return

    const provinceBounds = userProvince ? PROVINCE_BOUNDS[userProvince] : null
    if (provinceBounds) {
      didFitRef.current = true
      ;(async () => {
        const L = (await import('leaflet')).default
        map.fitBounds(L.latLngBounds(provinceBounds), { padding: [20, 20] })
      })()
      return
    }

    const pts: [number, number][] = [
      ...provinceHouseholds.map((h) => [h.lat, h.lng] as [number, number]),
      ...infra.map((i) => [Number(i.lat), Number(i.lng)] as [number, number]),
    ].filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln))
    if (pts.length === 0) return
    didFitRef.current = true
    ;(async () => {
      const L = (await import('leaflet')).default
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 13 })
    })()
  }, [mapReady, provinceHouseholds, infra, isNational, userProvince])

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
      <AppSidebar visibleKeys={visibleKeys} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <StatusStrip
        waterLevel={summarySnap[effectiveProvince]?.s2?.level ?? waterLevel}
        s1Level={summarySnap[effectiveProvince]?.s1?.level ?? null}
        s1Alert={summarySnap[effectiveProvince]?.s1?.alert ?? 'normal'}
        activeZone={activeZone}
        alertLevel={summarySnap[effectiveProvince]?.s2?.alert ?? alertLevel}
        vulnerable={vulnStats}
        updatedAt={alertUpdatedAt}
        province={effectiveProvince}
        onProvinceChange={onProvinceChange}
        lockProvince={!isNational || !!activeIncident}
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
            onCrFloodChange={onCrFloodChange}
            crFloodAnalysis={crFloodAnalysis}
            onShowFloodRoster={() => setActivePanel('crFloodRoster')}
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
            filterPriority={filterPriority}
            filterLifeSupport={filterLifeSupport}
            filterShelter={filterShelter}
            onToggleRisk={(v) => toggleIn(setFilterRisk, v)}
            onToggleGroup={(v) => toggleIn(setFilterGroups, v)}
            onToggleTambon={(v) => toggleIn(setFilterTambons, v)}
            onTogglePriority={(v) => toggleIn(setFilterPriority, v)}
            onToggleLifeSupport={(v) => toggleIn(setFilterLifeSupport, v)}
            onToggleShelter={(v) => toggleIn(setFilterShelter, v)}
            onClear={clearFilters}
            resultCount={filteredHouseholds.length}
            onClose={() => setActivePanel(null)}
          />
        )}
        {activePanel === 'zones' && (
          <RiskZonePanel
            // remount เมื่อสลับ วาดใหม่ ↔ แก้ไขโซน เพื่อ prefill ค่าฟอร์มจาก editingZone
            key={editingZone?.id ?? 'new'}
            zones={zonesWithCount}
            hazardTypes={hazardTypes}
            canEdit={canEditZones}
            drawing={drawing}
            draftCount={draftZone.length}
            editingZone={editingZone}
            onStartDraw={startDraw}
            onStartEdit={startEdit}
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
            persons={provinceVulnerable.filter((p) => !p.isAdmitted)}
            initialFilter={rosterFilter}
            onSelect={flyTo}
            admittedCount={provinceVulnerable.filter((p) => p.isAdmitted).length}
            onClose={() => { setActivePanel(null); setRosterFilter('all') }}
          />
        )}
        {activePanel === 'routes' && (
          <RoutesPanel
            persons={provinceVulnerable.filter((p) => !p.isAdmitted)}
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
        {activePanel === 'crFloodRoster' && crFloodHitMap && (
          <CrFloodRosterPanel
            households={provinceHouseholds}
            crFloodHitMap={crFloodHitMap}
            onSelect={flyToHousehold}
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
            focusHouseholdId={focusHouseholdId}
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
            onMapReady={(m) => { mapRef.current = m; setMapReady(true) }}
            onRequestHouseRoute={drawHouseRoute}
            canRequestEvac={canPin}
            onRequestEvacuation={requestEvacuation}
            riskZones={editingZone ? zonesWithCount.filter((z) => z.id !== editingZone.id) : zonesWithCount}
            drawMode={drawing}
            draftZone={draftZone}
            onDrawVertex={addDraftVertex}
            onMoveVertex={moveDraftVertex}
            onRemoveVertex={removeDraftVertex}
            evacPinMode={evacPinMode}
            onEvacPlace={onEvacPlace}
            crFlood={layers.crFlood}
            crFloodHitMap={crFloodHitMap}
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
              {canEditZones && (
                <button
                  type="button"
                  onClick={() => setEvacPinMode((v) => !v)}
                  title={evacPinMode ? 'คลิกบนแผนที่เพื่อวางจุดรับ-ส่งอพยพ (กดเพื่อยกเลิก)' : 'ปักจุดรับ-ส่งอพยพ'}
                  aria-label="ปักจุดรับ-ส่งอพยพ"
                  aria-pressed={evacPinMode}
                  className={`pointer-events-auto flex size-10 items-center justify-center rounded-md border transition-colors md:size-9 ${
                    evacPinMode
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]'
                  }`}
                >
                  <Ambulance size={16} strokeWidth={1.75} />
                </button>
              )}
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
          {canEditZones && (
            <EvacPointForm
              draft={evacDraft}
              onCancel={() => setEvacDraft(null)}
              onCreated={() => { setEvacDraft(null); void reloadInfra() }}
            />
          )}
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
