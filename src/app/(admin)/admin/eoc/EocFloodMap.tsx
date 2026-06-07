'use client'

/**
 * แผนที่สำหรับศูนย์บัญชาการ EOC — ใช้ FloodMap ตัวเดียวกับหน้า /map
 * (หมุดบ้าน cluster + popup สมาชิกครบ + หมุดสถานพยาบาล/ศูนย์พักพิง)
 * โหลด households (/api/family-folder/map) + infra (/api/infra) เองแบบ scope จังหวัดฝั่ง server
 */
import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { MapWrapper } from '@/components/map/MapWrapper'
import type {
  BasemapType,
  Infrastructure,
  LayerState,
  VulnerableHouseholdMarker,
} from '@/types'
import { Button } from '@/components/ui/button'

// เปิดเฉพาะชั้นที่ EOC ต้องเห็น — หมุดบ้าน + สถานพยาบาล (ชั้นน้ำท่วม/หมุดสำรวจปิดไว้)
const EOC_LAYERS: LayerState = {
  gistda: { flood1d: false, flood3d: false, flood7d: false, flood30d: false, floodFreq: false, waterHyacinth: false },
  floodMarks: { '1': false, '2': false, '3': false, '4': false, '5': false },
  cmuFlood: { flood1: false, flood2: false, flood3: false, flood4: false, flood5: false, river: false, parking: false, shelter: false, pole: false, s1a: false },
  crFlood: { cr_cei: false, cr_detail: false, cr_flow1500: false, cr_flow2000: false, ms_coarse: false, ms_detail: false },
  vulnerable: true,
  infra: true,
  routes: true,
  userFloodMarks: false,
}

const BASEMAPS: { value: BasemapType; label: string }[] = [
  { value: 'sat', label: 'ดาวเทียม' },
  { value: 'osm', label: 'พื้นฐาน' },
  { value: 'topo', label: 'ภูมิประเทศ' },
]

interface Props {
  sessionUserId?: string | null
  sessionRole?: string | null
}

export default function EocFloodMap({ sessionUserId = null, sessionRole = null }: Props) {
  const [households, setHouseholds] = useState<VulnerableHouseholdMarker[]>([])
  const [infra, setInfra] = useState<Infrastructure[]>([])
  const [basemap, setBasemap] = useState<BasemapType>('sat')
  const mapRef = useRef<LeafletMap | null>(null)
  const didFitRef = useRef(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/family-folder/map').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/infra').then((r) => (r.ok ? r.json() : { data: [] })).then((j) => j.data ?? []).catch(() => []),
    ]).then(([h, i]) => {
      setHouseholds(Array.isArray(h) ? h : [])
      setInfra(Array.isArray(i) ? i : [])
    })
  }, [])

  // โฟกัสแผนที่ตามข้อมูลครั้งแรกที่ทั้งแผนที่และข้อมูลพร้อม
  useEffect(() => {
    const map = mapRef.current
    if (!map || didFitRef.current) return
    const pts: [number, number][] = [
      ...households.map((h) => [h.lat, h.lng] as [number, number]),
      ...infra.map((i) => [Number(i.lat), Number(i.lng)] as [number, number]),
    ].filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln))
    if (pts.length === 0) return
    didFitRef.current = true
    ;(async () => {
      const L = (await import('leaflet')).default
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 })
    })()
  }, [households, infra])

  return (
    <div className="relative size-full">
      <MapWrapper
        layers={EOC_LAYERS}
        households={households}
        infra={infra}
        basemap={basemap}
        floodMarkProvince={null}
        sessionUserId={sessionUserId}
        sessionRole={sessionRole}
        // eslint-disable-next-line react-hooks/immutability
        onMapReady={(m) => { mapRef.current = m }}
      />
      <div className="absolute right-3 top-3 z-[500] flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 shadow-sm">
        {BASEMAPS.map((b) => {
          const active = basemap === b.value
          return (
            <Button
              key={b.value}
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setBasemap(b.value)}
              aria-pressed={active}
              className={`rounded-md px-2 text-[11.5px] ${active ? 'bg-[var(--bg-sunken)] font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
            >
              {b.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
