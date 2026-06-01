'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker, TileLayer } from 'leaflet'

/**
 * แผนที่ปักพิกัด — คลิกหรือลากหมุดเพื่อกำหนดตำแหน่ง
 * vanilla leaflet (dynamic import) + divIcon (กันปัญหา marker icon หายตอน bundle)
 * รองรับสลับ basemap: แผนที่ / ดาวเทียม / ภาพถ่าย+ถนน
 */

type BasemapKey = 'street' | 'satellite' | 'hybrid'

const BASEMAPS: Record<BasemapKey, { label: string; urls: string[]; maxZoom: number }> = {
  street: {
    label: 'แผนที่',
    urls: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'],
    maxZoom: 19,
  },
  satellite: {
    label: 'ดาวเทียม',
    urls: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    ],
    maxZoom: 19,
  },
  hybrid: {
    label: 'ภาพถ่าย+ถนน',
    urls: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
    maxZoom: 20,
  },
}

export function LocationPicker({
  lat,
  lng,
  onChange,
  heightClass = 'h-[200px]',
}: {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  /** ปรับความสูงแผนที่ (เช่นตอนเปิดเต็มจอ) — default 200px */
  heightClass?: string
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const tileRef = useRef<TileLayer[]>([])
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const [basemap, setBasemap] = useState<BasemapKey>('street')

  // mount แผนที่ครั้งเดียว
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !elRef.current || mapRef.current) return
      leafletRef.current = L

      const map = L.map(elRef.current, { attributionControl: false }).setView([lat, lng], 14)
      mapRef.current = map

      const conf = BASEMAPS.street
      tileRef.current = conf.urls.map((u) => L.tileLayer(u, { maxZoom: conf.maxZoom }).addTo(map))

      const icon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:oklch(0.66 0.20 30);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      })
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
      markerRef.current = marker

      marker.on('dragend', () => {
        const p = marker.getLatLng()
        onChangeRef.current(p.lat, p.lng)
      })
      map.on('click', (e) => {
        marker.setLatLng(e.latlng)
        onChangeRef.current(e.latlng.lat, e.latlng.lng)
      })
      setTimeout(() => map.invalidateSize(), 120)
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      tileRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // สลับ basemap
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return
    tileRef.current.forEach((t) => map.removeLayer(t))
    const conf = BASEMAPS[basemap]
    tileRef.current = conf.urls.map((u) => L.tileLayer(u, { maxZoom: conf.maxZoom }).addTo(map))
  }, [basemap])

  // sync เมื่อค่าภายนอกเปลี่ยน (เช่น กดปุ่ม GPS / พิมพ์เลขเอง)
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const cur = marker.getLatLng()
    if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) {
      marker.setLatLng([lat, lng])
      map.setView([lat, lng])
    }
  }, [lat, lng])

  return (
    <div className={`relative ${heightClass} w-full`}>
      <div ref={elRef} className="h-full w-full overflow-hidden rounded-md border border-[var(--border)]" />
      {/* ตัวสลับ basemap */}
      <div className="absolute right-2 top-2 z-[400] flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] shadow-sm">
        {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setBasemap(key)}
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              basemap === key
                ? 'bg-[var(--accent)] font-medium text-white'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)]'
            }`}
          >
            {BASEMAPS[key].label}
          </button>
        ))}
      </div>
    </div>
  )
}
