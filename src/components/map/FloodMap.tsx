'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import type {
  Map as LeafletMap,
  Layer,
  LayerGroup,
  MarkerClusterGroup,
  TileLayer,
} from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import type {
  BasemapType,
  CmuFloodLayerConfig,
  CmuFloodLayerKey,
  FloodMark,
  FloodMarkLevel,
  LayerState,
  UserFloodMark,
  VulnerablePerson,
  VulnerableHouseholdMarker,
  Infrastructure,
  RiskLevel,
  FloodRiskZone,
  GistdaLayerKey,
} from '@/types'
import { CMU_FLOOD_LAYERS, FLOOD_MARK_LEVELS, GISTDA_LAYERS } from '@/types'
import { buildEvacRoute, nearestShelter } from '@/lib/geo'

type LeafletContainer = HTMLDivElement & { _leaflet_id?: number | null }

const RISK_COLOR: Record<RiskLevel, string> = {
  flood: 'oklch(0.66 0.20 30)',
  near: 'oklch(0.78 0.16 75)',
  safe: 'oklch(0.74 0.10 145)',
}

// สีโซนเสี่ยงตามลำดับการท่วม — ลำดับน้อย = ท่วมก่อน = แดงเข้ม
function zoneColor(priority: number): string {
  if (priority <= 1) return 'oklch(0.60 0.23 25)'
  if (priority === 2) return 'oklch(0.72 0.18 55)'
  return 'oklch(0.80 0.15 85)'
}

const INFRA_COLOR: Record<string, string> = {
  hospital: 'var(--infra-medical)',
  clinic: 'var(--infra-medical)',
  shelter: 'var(--infra-shelter)',
  assembly: 'var(--infra-shelter)',
}

const INFRA_LABEL: Record<string, string> = {
  hospital: 'โรงพยาบาล',
  clinic: 'รพ.สต.',
  shelter: 'ศูนย์อพยพ',
  assembly: 'จุดรวมพล',
}

// Lucide SVG paths — kept in sync with the icons used in InfraPanel
// (Hospital, Stethoscope, Tent, Flag)
const INFRA_SVG: Record<string, string> = {
  hospital: `<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>`,
  clinic: `<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>`,
  shelter: `<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>`,
  assembly: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>`,
}

const GROUP_COLOR: Record<string, string> = {
  'ผู้สูงอายุ': 'oklch(0.78 0.16 75)',
  'เด็กเล็ก': 'oklch(0.72 0.14 350)',
  'ผู้พิการ': 'oklch(0.62 0.18 305)',
  'โรคเรื้อรัง': 'oklch(0.66 0.20 30)',
  'ทั่วไป': 'var(--fg-subtle)',
}

// ลำดับความรุนแรง — ใช้เลือกสี cluster ตามบ้านที่เสี่ยงสุดในกลุ่ม
const RISK_SEVERITY: Record<RiskLevel, number> = { flood: 2, near: 1, safe: 0 }

// ไอคอน cluster — สีตามบ้านที่เสี่ยงสุดในกลุ่ม + ขนาดตามจำนวน + รวมจำนวนคนเปราะบาง
function clusterIconHtml(houseCount: number, vulnTotal: number, risk: RiskLevel): string {
  const color = RISK_COLOR[risk] ?? 'var(--border)'
  const size = houseCount >= 50 ? 52 : houseCount >= 15 ? 46 : 40
  return `
    <div style="
      position:relative;width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      border-radius:50%;
      background:color-mix(in oklch, ${color} 28%, var(--bg-elevated));
      border:2.5px solid ${color};
      box-shadow:0 2px 8px oklch(0 0 0 / 0.4);
      color:${color};font-family:var(--font-mono);font-weight:700;line-height:1;
    ">
      <span style="font-size:${size >= 46 ? 15 : 13}px">${houseCount}</span>
      <div style="
        position:absolute;bottom:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;
        display:flex;align-items:center;justify-content:center;gap:2px;
        border-radius:9px;background:${color};color:var(--bg);
        font-size:10px;font-weight:700;border:1.5px solid var(--bg-elevated);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5c0 3 5 8 5 8s5-5 5-8a5 5 0 0 0-5-5z"/></svg>${vulnTotal}
      </div>
    </div>
  `
}

// หมุดบ้าน — แสดง badge จำนวนกลุ่มเปราะบางในบ้าน
function houseMarkerHtml(vulnerableCount: number, risk: RiskLevel): string {
  const ringColor = RISK_COLOR[risk] ?? 'var(--border)'
  return `
    <div style="position:relative;width:30px;height:30px">
      <div style="
        width:30px;height:30px;
        display:flex;align-items:center;justify-content:center;
        border-radius:8px;
        background:color-mix(in oklch, ${ringColor} 22%, var(--bg-elevated));
        border:2.5px solid ${ringColor};
        box-shadow:0 2px 6px oklch(0 0 0 / 0.45);
        color:${ringColor};
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>
        </svg>
      </div>
      <div style="
        position:absolute;top:-7px;right:-7px;min-width:17px;height:17px;padding:0 4px;
        display:flex;align-items:center;justify-content:center;
        border-radius:9px;background:${ringColor};color:var(--bg);
        font-family:var(--font-mono);font-size:10px;font-weight:700;line-height:1;
        border:1.5px solid var(--bg-elevated);
      ">${vulnerableCount}</div>
    </div>
  `
}

function householdPopupHtml(h: VulnerableHouseholdMarker, risk: RiskLevel, canRequestEvac: boolean): string {
  const riskLabel: Record<RiskLevel, string> = {
    flood: 'ในเขตน้ำท่วม',
    near: 'ใกล้เขตน้ำท่วม',
    safe: 'นอกเขตน้ำท่วม',
  }
  const ringColor = RISK_COLOR[risk]
  const villageLabel = h.village && !h.village.startsWith('บ้าน') ? `บ้าน${h.village}` : h.village
  const address = [villageLabel || null, h.villno ? `หมู่ ${h.villno}` : null, h.tambon, h.amphoe, h.province]
    .filter(Boolean)
    .join(' · ')

  const phoneCell = (phone?: string | null) =>
    phone
      ? `<a href="tel:${escapeHtml(phone.replace(/[^0-9+]/g, ''))}" style="font-family:var(--font-mono);font-size:11.5px;color:var(--accent);text-decoration:none;white-space:nowrap">${escapeHtml(phone)}</a>`
      : '<span style="color:var(--fg-subtle)">-</span>'

  const headTag = (isHead?: boolean) =>
    isHead ? ' <span style="font-size:9px;color:var(--fg-subtle)">(หัวหน้าครัวเรือน)</span>' : ''

  // คนเปราะบาง → ชื่อ + ความสัมพันธ์·อายุ + badge กลุ่ม
  const vulnRow = (m: VulnerableHouseholdMarker['members'][number]) => {
    const gColor = GROUP_COLOR[m.group] ?? 'var(--fg-subtle)'
    const name = m.name ? escapeHtml(m.name) : 'สมาชิก'
    const meta = [m.position, m.age != null ? `${m.age} ปี` : null].filter(Boolean).join(' · ')
    return `<div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:6px 0;border-left:2.5px solid ${gColor};padding-left:8px">
      <div>
        <div style="font-size:12.5px;font-weight:600;color:var(--fg)">${name}${headTag(m.isHead)}</div>
        ${meta ? `<div style="font-size:10.5px;color:var(--fg-subtle)">${escapeHtml(meta)}</div>` : ''}
        <span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:4px;font-size:9.5px;background:color-mix(in oklch, ${gColor} 18%, transparent);color:${gColor}">${m.group}</span>
      </div>
      <div style="align-self:center">${phoneCell(m.phone)}</div>
    </div>`
  }

  // คนทั่วไป → แค่ เพศ·อายุ (ไม่มีชื่อ) + เบอร์
  const otherRow = (m: VulnerableHouseholdMarker['members'][number]) => {
    const sexAge = [m.sex && m.sex !== '-' ? m.sex : null, m.age != null ? `${m.age} ปี` : null]
      .filter(Boolean)
      .join(' · ') || 'สมาชิก'
    return `<div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:6px 0;border-left:2.5px solid var(--border);padding-left:8px">
      <div style="font-size:12.5px;font-weight:500;color:var(--fg);align-self:center">${escapeHtml(sexAge)}${headTag(m.isHead)}</div>
      <div style="align-self:center">${phoneCell(m.phone)}</div>
    </div>`
  }

  const vulnMembers = h.members.filter((m) => m.isVulnerable)
  const otherMembers = h.members.filter((m) => !m.isVulnerable)

  const sectionLabel = (text: string) =>
    `<div style="font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-subtle);margin:2px 0">${text}</div>`

  const vulnSection = vulnMembers.length
    ? `${sectionLabel(`กลุ่มเปราะบาง (${vulnMembers.length})`)}<div style="margin-bottom:8px">${vulnMembers.map(vulnRow).join('')}</div>`
    : ''
  const otherSection = otherMembers.length
    ? `${sectionLabel(`สมาชิกอื่นในบ้าน (${otherMembers.length})`)}<div style="margin-bottom:8px">${otherMembers.map(otherRow).join('')}</div>`
    : ''

  return `<div style="min-width:260px;max-width:300px">
    <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:2px">ครัวเรือน${h.hno ? ` · บ้านเลขที่ ${escapeHtml(h.hno)}` : ''}</div>
    <div style="font-size:13px;font-weight:600;color:var(--fg);margin-bottom:6px;line-height:1.35">${escapeHtml(address || '-')}</div>
    <div style="display:flex;gap:6px;align-items:center;padding:5px 8px;border-radius:6px;background:color-mix(in oklch, ${ringColor} 14%, transparent);color:${ringColor};font-size:11px;font-weight:500;margin-bottom:8px">
      <span style="width:6px;height:6px;border-radius:50%;background:${ringColor}"></span>
      ${riskLabel[risk]} · สมาชิก ${h.members.length} คน
    </div>
    <div style="max-height:240px;overflow-y:auto;margin-bottom:8px">${vulnSection}${otherSection}</div>
    <button id="evac-${h.id}" style="width:100%;padding:7px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:11.5px;font-family:var(--font-sans);cursor:pointer">
      แสดงเส้นทางอพยพ →
    </button>
    ${canRequestEvac ? `<button id="req-evac-${h.id}" style="width:100%;margin-top:6px;padding:7px;border-radius:6px;border:none;background:var(--risk-flood);color:#fff;font-size:11.5px;font-weight:600;font-family:var(--font-sans);cursor:pointer">
      🚨 สั่งอพยพ (สร้างคำขอ)
    </button>` : ''}
  </div>`
}

function infraMarkerHtml(type: string): string {
  const svg = INFRA_SVG[type] ?? ''
  return `
    <div class="infra-marker-icon infra-marker-icon-${type}">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
      >${svg}</svg>
    </div>
  `
}

const TILE_URLS: Record<BasemapType, string | string[]> = {
  sat: [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  ],
  street:
    'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
  topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  hybrid:
    'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
  google: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}&apistyle=s.t%3A33%7Cp.v%3Aoff',
  google_sat: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&apistyle=s.t%3A33%7Cp.v%3Aoff',
}

interface Props {
  layers: LayerState
  households: VulnerableHouseholdMarker[]
  infra: Infrastructure[]
  basemap: BasemapType
  floodMarkProvince: string | null
  focusHouseholdId?: string | null
  userFloodMarks?: UserFloodMark[]
  pinMode?: boolean
  onPinPlace?: (lat: number, lng: number) => void
  pinDraft?: { lat: number; lng: number } | null
  onPinDragEnd?: (lat: number, lng: number) => void
  sessionUserId?: string | null
  sessionRole?: string | null
  onDeleteMark?: (id: string) => void
  onMapReady?: (map: LeafletMap) => void
  onRequestHouseRoute?: (lat: number, lng: number, label: string) => void
  canRequestEvac?: boolean
  onRequestEvacuation?: (h: VulnerableHouseholdMarker) => Promise<boolean>
  riskZones?: FloodRiskZone[]
  drawMode?: boolean
  draftZone?: [number, number][] // [lat, lng][] ระหว่างวาด
  onDrawVertex?: (lat: number, lng: number) => void
}

export function FloodMap({
  layers,
  households,
  infra,
  basemap,
  floodMarkProvince,
  focusHouseholdId,
  userFloodMarks = [],
  pinMode = false,
  onPinPlace,
  pinDraft = null,
  onPinDragEnd,
  sessionUserId = null,
  sessionRole = null,
  onDeleteMark,
  onMapReady,
  onRequestHouseRoute,
  canRequestEvac = false,
  onRequestEvacuation,
  riskZones = [],
  drawMode = false,
  draftZone = [],
  onDrawVertex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const baseLayers = useRef<TileLayer[]>([])
  const vulnGroupRef = useRef<MarkerClusterGroup | null>(null)
  const riskZoneGroupRef = useRef<LayerGroup | null>(null)
  const draftZoneGroupRef = useRef<LayerGroup | null>(null)
  const infraGroupRef = useRef<LayerGroup | null>(null)
  const routeGroupRef = useRef<LayerGroup | null>(null)
  const markerMapRef = useRef<Map<string, import('leaflet').Marker>>(new Map())
  const gistdaRefs = useRef<Partial<Record<GistdaLayerKey, TileLayer>>>({})
  const floodMarkGroupRefs = useRef<Partial<Record<FloodMarkLevel, LayerGroup>>>({})
  const floodMarkCacheRef = useRef<Partial<Record<FloodMarkLevel, FloodMark[]>>>({})
  const userFloodMarkGroupRef = useRef<LayerGroup | null>(null)
  const draftMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const cmuFloodGroupRefs = useRef<Partial<Record<CmuFloodLayerKey, LayerGroup>>>({})
  const cmuFloodLoadedRef = useRef<Partial<Record<CmuFloodLayerKey, boolean>>>({})
  const [mapReady, setMapReady] = useState(false)

  // Init Leaflet
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    let isMounted = true
      ; (async () => {
        const L = (await import('leaflet')).default
        // leaflet.markercluster เป็น UMD ที่อ้าง global `L` ตอนโหลด — ต้องเซ็ตก่อน import ปลั๊กอิน
        ;(window as unknown as { L?: typeof L }).L = L
        await import('leaflet.markercluster')
        if (!isMounted || !containerRef.current) return

        const container = containerRef.current as LeafletContainer
        if (container._leaflet_id) {
          container._leaflet_id = null
        }

        const map = L.map(container, {
          center: [18.78, 98.98],
          zoom: 11,
          zoomControl: false,
          attributionControl: true,
        })
        L.control.zoom({ position: 'bottomright' }).addTo(map)
        mapRef.current = map
        onMapReady?.(map)

        const urls = TILE_URLS[basemap]
        if (Array.isArray(urls)) {
          const ls = urls.map((u, i) =>
            L.tileLayer(u, { maxZoom: 19, opacity: i === 1 ? 0.7 : 1 }),
          )
          ls.forEach((l) => l.addTo(map))
          baseLayers.current = ls
        } else {
          const l = L.tileLayer(urls, { maxZoom: 19, subdomains: 'abcd' })
          l.addTo(map)
          baseLayers.current = [l]
        }

        vulnGroupRef.current = L.markerClusterGroup({
          maxClusterRadius: 50,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          chunkedLoading: true,
          iconCreateFunction: (cluster) => {
            const children = cluster.getAllChildMarkers()
            let worst: RiskLevel = 'safe'
            let vulnTotal = 0
            for (const m of children) {
              const meta = (m as unknown as { __meta?: { risk: RiskLevel; vuln: number } }).__meta
              if (!meta) continue
              vulnTotal += meta.vuln
              if (RISK_SEVERITY[meta.risk] > RISK_SEVERITY[worst]) worst = meta.risk
            }
            return L.divIcon({
              className: 'house-cluster',
              html: clusterIconHtml(children.length, vulnTotal, worst),
              iconSize: [40, 40],
            })
          },
        }).addTo(map)
        infraGroupRef.current = L.layerGroup().addTo(map)
        routeGroupRef.current = L.layerGroup().addTo(map)
        userFloodMarkGroupRef.current = L.layerGroup().addTo(map)
        FLOOD_MARK_LEVELS.forEach((cfg) => {
          floodMarkGroupRefs.current[cfg.key] = L.layerGroup()
        })
        CMU_FLOOD_LAYERS.forEach((cfg, i) => {
          cmuFloodGroupRefs.current[cfg.key] = L.layerGroup()
          if (cfg.kind === 'flood') {
            map.createPane(cfg.key)
            map.getPane(cfg.key)!.style.zIndex = String(450 - i)
          }
        })

        GISTDA_LAYERS.forEach((cfg) => {
          const tile = L.tileLayer(
            `/api/gistda/maps/${cfg.tmsPath}/tms/{z}/{x}/{y}`,
            {
              maxZoom: 18,
              opacity: 0.7,
              // GISTDA's `/tms/` endpoint serves standard XYZ (top-left origin)
              // per the QGIS XYZ-Tiles example in the manual.
              tms: false,
            },
          )
          gistdaRefs.current[cfg.key] = tile
        })

        setMapReady(true)
      })()

    return () => {
      isMounted = false
      setMapReady(false)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // เมื่อ container เปลี่ยนขนาด (หุบ panel ซ้าย / เปิด-ปิด sidebar / resize หน้าต่าง)
  // Leaflet ต้องวัดขนาดใหม่ ไม่งั้น tile ฝั่งที่เพิ่งโผล่จะไม่โหลด (พื้นที่เทา)
  useEffect(() => {
    if (!mapReady || !containerRef.current) return
    const invalidate = () => {
      try {
        mapRef.current?.invalidateSize()
      } catch {
        // Leaflet อาจ throw ระหว่าง pane กำลัง settle — เพิกเฉยได้
      }
    }
    const observer = new ResizeObserver(invalidate)
    observer.observe(containerRef.current)
    window.addEventListener('resize', invalidate)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', invalidate)
    }
  }, [mapReady])

  // หมุดบ้าน — 1 หมุด/ครัวเรือนที่มีกลุ่มเปราะบาง popup แสดงสมาชิกทุกคน + เบอร์
  useEffect(() => {
    if (!mapReady || !vulnGroupRef.current) return
      ; (async () => {
        const L = (await import('leaflet')).default
        const vg = vulnGroupRef.current!
        vg.clearLayers()
        markerMapRef.current.clear()

        households.forEach((h) => {
          const risk: RiskLevel = (h.risk ?? 'safe') as RiskLevel

          const icon = L.divIcon({
            className: 'house-marker',
            html: houseMarkerHtml(h.vulnerableCount, risk),
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          })

          const marker = L.marker([h.lat, h.lng], { icon })
          ;(marker as unknown as { __meta: { risk: RiskLevel; vuln: number } }).__meta = {
            risk,
            vuln: h.vulnerableCount,
          }
          markerMapRef.current.set(h.id, marker)
          marker.bindPopup(householdPopupHtml(h, risk, canRequestEvac), { maxWidth: 320 })

          marker.on('popupopen', () => {
            setTimeout(() => {
              const btn = document.getElementById(`evac-${h.id}`)
              btn?.addEventListener(
                'click',
                () => {
                  const label = h.hno ? `บ้านเลขที่ ${h.hno}` : `บ้าน${h.village}`
                  onRequestHouseRoute?.(h.lat, h.lng, label)
                },
                { once: true },
              )

              const reqBtn = document.getElementById(`req-evac-${h.id}`) as HTMLButtonElement | null
              if (reqBtn && onRequestEvacuation) {
                reqBtn.addEventListener('click', async () => {
                  if (reqBtn.disabled) return
                  reqBtn.disabled = true
                  reqBtn.textContent = 'กำลังส่งคำขอ…'
                  const ok = await onRequestEvacuation(h)
                  if (ok) {
                    reqBtn.textContent = '✓ ส่งคำขออพยพแล้ว'
                    reqBtn.style.background = 'var(--risk-safe)'
                  } else {
                    reqBtn.textContent = '✕ ส่งไม่สำเร็จ — แตะเพื่อลองใหม่'
                    reqBtn.disabled = false
                  }
                })
              }
            }, 0)
          })

          vg.addLayer(marker)
        })
      })()
  }, [mapReady, households, onRequestHouseRoute, canRequestEvac, onRequestEvacuation])

  // เปิด popup ของบ้านเมื่อ focusHouseholdId เปลี่ยน
  useEffect(() => {
    if (focusHouseholdId == null || !mapReady) return
    const map = mapRef.current
    const marker = markerMapRef.current.get(focusHouseholdId)
    const group = vulnGroupRef.current
    if (!map || !marker) return
    map.closePopup()
    // หมุดอาจถูกซ่อนใน cluster — ขยาย cluster ให้เห็นหมุดก่อนเปิด popup
    if (group) {
      group.zoomToShowLayer(marker, () => marker.openPopup())
    } else {
      map.once('moveend', () => marker.openPopup())
    }
  }, [focusHouseholdId, mapReady])

  // Infra markers (vector squares using divIcon, no emoji)
  useEffect(() => {
    if (!mapReady || !infraGroupRef.current) return
      ; (async () => {
        const L = (await import('leaflet')).default
        const ig = infraGroupRef.current!
        ig.clearLayers()

        infra.forEach((i) => {
          const icon = L.divIcon({
            className: 'infra-marker',
            html: infraMarkerHtml(i.type),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
          L.marker([Number(i.lat), Number(i.lng)], { icon })
            .bindPopup(
              `<div>
              <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">${INFRA_LABEL[i.type] ?? i.type}</div>
              <div style="font-size:14px;font-weight:600;margin-bottom:4px">${i.name}</div>
              <div style="font-size:12px;color:var(--fg-muted)">ความจุ: <span style="font-family:var(--font-mono)">${i.capacity ?? i.cap ?? '—'}</span></div>
            </div>`,
            )
            .addTo(ig)
        })
      })()
  }, [mapReady, infra])

  // Flood Mark survey points from CMU Water Center, loaded only for active levels.
  useEffect(() => {
    if (!mapReady) return
    let cancelled = false
      ; (async () => {
        const L = (await import('leaflet')).default

        await Promise.all(
          FLOOD_MARK_LEVELS.map(async (cfg) => {
            if (!layers.floodMarks[cfg.key]) return

            const group = floodMarkGroupRefs.current[cfg.key]
            if (!group) return

            const cached = floodMarkCacheRef.current[cfg.key]
            if (cached) {
              renderFloodMarks(L, group, cached, cfg.key, floodMarkProvince)
              return
            }

            try {
              const res = await fetch(`/api/flood-marks/${cfg.key}`)
              if (!res.ok) {
                console.warn('[flood-marks] request failed', cfg.key, res.status)
                return
              }

              const marks = (await res.json()) as FloodMark[]
              if (cancelled) return

              floodMarkCacheRef.current[cfg.key] = marks
              renderFloodMarks(L, group, marks, cfg.key, floodMarkProvince)
            } catch (err) {
              console.error('[flood-marks] request error', cfg.key, err)
            }
          }),
        )
      })()

    return () => {
      cancelled = true
    }
  }, [mapReady, layers.floodMarks, floodMarkProvince])

  // CMU Water Center layers for Chiang Mai flood scenarios and response points.
  useEffect(() => {
    if (!mapReady) return
    let cancelled = false
      ; (async () => {
        const L = (await import('leaflet')).default

        await Promise.all(
          CMU_FLOOD_LAYERS.map(async (cfg) => {
            if (!layers.cmuFlood[cfg.key] || cmuFloodLoadedRef.current[cfg.key]) return

            const group = cmuFloodGroupRefs.current[cfg.key]
            if (!group) return

            try {
              const url = cfg.path.startsWith('/') ? cfg.path : `/api/cmu-flood/${cfg.path}`
              const res = await fetch(url)
              if (!res.ok) {
                console.warn('[cmu-flood] request failed', cfg.key, res.status)
                return
              }

              if (cfg.format === 'kml') {
                const xml = await res.text()
                if (cancelled) return
                renderCmuKmlLayer(L, group, xml, cfg)
              } else {
                const geo = (await res.json()) as GeoJsonObject
                if (cancelled) return
                renderCmuGeoJsonLayer(L, group, geo, cfg)
              }

              cmuFloodLoadedRef.current[cfg.key] = true
            } catch (err) {
              console.error('[cmu-flood] request error', cfg.key, err)
            }
          }),
        )
      })()

    return () => {
      cancelled = true
    }
  }, [mapReady, layers.cmuFlood])

  // User-pinned flood marks (officer/vhv) — distinct dashed style from CMU marks
  useEffect(() => {
    if (!mapReady || !userFloodMarkGroupRef.current) return
      ; (async () => {
        const L = (await import('leaflet')).default
        renderUserFloodMarks(L, userFloodMarkGroupRef.current!, userFloodMarks, {
          sessionUserId,
          sessionRole,
          onDeleteMark,
        })
      })()
  }, [mapReady, userFloodMarks, sessionUserId, sessionRole, onDeleteMark])

  // Pin mode — click on map to capture a coordinate for a new flood mark
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const container = map.getContainer()
    if (pinMode) {
      container.style.cursor = 'crosshair'
      const handler = (e: import('leaflet').LeafletMouseEvent) => {
        onPinPlace?.(e.latlng.lat, e.latlng.lng)
      }
      map.on('click', handler)
      return () => {
        map.off('click', handler)
        container.style.cursor = ''
      }
    }
    container.style.cursor = ''
  }, [pinMode, mapReady, onPinPlace])

  // โซนเสี่ยงน้ำท่วม — render polygon (เก็บ [lng,lat] → leaflet ใช้ [lat,lng])
  useEffect(() => {
    if (!mapReady) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return
      const g = riskZoneGroupRef.current ?? (riskZoneGroupRef.current = L.layerGroup().addTo(mapRef.current))
      g.clearLayers()
      riskZones.forEach((z) => {
        const latlng = z.polygon.map(([lng, lat]) => [lat, lng] as [number, number])
        if (latlng.length < 3) return
        const color = zoneColor(z.priority)
        L.polygon(latlng, { color, weight: 2, fillColor: color, fillOpacity: 0.18, dashArray: '4,4' })
          .bindTooltip(`${z.name} · ลำดับ ${z.priority}`, { sticky: true })
          .addTo(g)
      })
    })()
    return () => { cancelled = true }
  }, [mapReady, riskZones])

  // โซนที่กำลังวาด — polyline/polygon ชั่วคราว + จุด vertex มีลำดับ
  useEffect(() => {
    if (!mapReady) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return
      const g = draftZoneGroupRef.current ?? (draftZoneGroupRef.current = L.layerGroup().addTo(mapRef.current))
      g.clearLayers()
      if (draftZone.length === 0) return
      const color = 'oklch(0.60 0.23 25)'
      if (draftZone.length >= 2) {
        L.polygon(draftZone, { color, weight: 2, fillColor: color, fillOpacity: 0.1, dashArray: '5,5' }).addTo(g)
      }
      draftZone.forEach(([la, ln], i) => {
        L.circleMarker([la, ln], { radius: 4, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(String(i + 1), { permanent: true, direction: 'top', className: 'draft-vertex-label' })
          .addTo(g)
      })
    })()
    return () => { cancelled = true }
  }, [mapReady, draftZone])

  // โหมดวาดโซน — คลิกบนแผนที่เพื่อเพิ่มจุด
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const container = map.getContainer()
    if (drawMode) {
      container.style.cursor = 'crosshair'
      const handler = (e: import('leaflet').LeafletMouseEvent) => {
        onDrawVertex?.(e.latlng.lat, e.latlng.lng)
      }
      map.on('click', handler)
      return () => {
        map.off('click', handler)
        container.style.cursor = ''
      }
    }
  }, [drawMode, mapReady, onDrawVertex])

  // Draft marker — แสดงจุดที่กำลังจะปัก (ลากเพื่อปรับตำแหน่งได้)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return
      if (!pinDraft) {
        draftMarkerRef.current?.remove()
        draftMarkerRef.current = null
        return
      }
      const icon = L.divIcon({
        className: 'flood-draft-marker',
        html:
          '<div style="width:16px;height:16px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 0 0 2px var(--accent),0 1px 5px rgba(0,0,0,.5)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      if (!draftMarkerRef.current) {
        const marker = L.marker([pinDraft.lat, pinDraft.lng], {
          icon,
          draggable: true,
          zIndexOffset: 1000,
        }).addTo(map)
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          onPinDragEnd?.(ll.lat, ll.lng)
        })
        draftMarkerRef.current = marker
      } else {
        draftMarkerRef.current.setLatLng([pinDraft.lat, pinDraft.lng])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pinDraft, mapReady, onPinDragEnd])

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const toggle = (layer: Layer | null | undefined, on: boolean) => {
      if (!layer) return
      if (on && !map.hasLayer(layer)) map.addLayer(layer)
      if (!on && map.hasLayer(layer)) map.removeLayer(layer)
    }
    toggle(vulnGroupRef.current, layers.vulnerable)
    toggle(infraGroupRef.current, layers.infra)
    toggle(routeGroupRef.current, layers.routes)
    toggle(userFloodMarkGroupRef.current, layers.userFloodMarks)
    FLOOD_MARK_LEVELS.forEach((cfg) => {
      toggle(floodMarkGroupRefs.current[cfg.key], layers.floodMarks[cfg.key])
    })
    GISTDA_LAYERS.forEach((cfg) => {
      toggle(gistdaRefs.current[cfg.key], layers.gistda[cfg.key])
    })
    CMU_FLOOD_LAYERS.forEach((cfg) => {
      toggle(cmuFloodGroupRefs.current[cfg.key], layers.cmuFlood[cfg.key])
    })
  }, [layers, mapReady])

  // Basemap switching
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
      ; (async () => {
        const L = (await import('leaflet')).default
        baseLayers.current.forEach((l) => map.removeLayer(l))
        const urls = TILE_URLS[basemap]
        if (Array.isArray(urls)) {
          const ls = urls.map((u, i) =>
            L.tileLayer(u, { maxZoom: 19, opacity: i === 1 ? 0.7 : 1 }),
          )
          ls.forEach((l) => l.addTo(map))
          baseLayers.current = ls
        } else {
          const l = L.tileLayer(urls, { maxZoom: 19, subdomains: 'abcd' })
          l.addTo(map)
          baseLayers.current = [l]
        }
      })()
  }, [basemap])

  return <div ref={containerRef} className="size-full" />
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function popupText(value: string | number | null | undefined, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback
  return escapeHtml(String(value))
}

function floodMarkColor(level: FloodMarkLevel): string {
  return (
    FLOOD_MARK_LEVELS.find((cfg) => cfg.key === level)?.color ??
    'oklch(0.78 0.16 75)'
  )
}

function renderFloodMarks(
  L: typeof import('leaflet'),
  group: import('leaflet').LayerGroup,
  marks: FloodMark[],
  level: FloodMarkLevel,
  province: string | null,
) {
  group.clearLayers()
  const color = floodMarkColor(level)
  const label =
    FLOOD_MARK_LEVELS.find((cfg) => cfg.key === level)?.label ??
    `Flood Mark ระดับ ${level}`

  marks
    .filter((mark) => !province || mark.province === province)
    .forEach((mark) => {
      const waterLevel = mark.waterLevel ?? 0
      const radius = Math.max(4.5, Math.min(9, 4 + waterLevel / 45))
      const detail = mark.placeDetail ?? mark.otherDetail ?? 'ไม่ระบุสถานที่'
      const reportUrl = `https://watercenter.scmc.cmu.ac.th/cmflood/flood24/report/${encodeURIComponent(mark.code)}`

      L.circleMarker([mark.latitude, mark.longitude], {
        radius,
        color,
        weight: 1.75,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: 0.45,
      })
        .bindPopup(
          `<div style="min-width:220px">
          <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">${escapeHtml(label)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
            <a href="${reportUrl}" target="_blank" rel="noopener" style="font-size:13px;font-weight:600;color:var(--accent);text-decoration:none">${popupText(mark.code)}</a>
            <span style="font-family:var(--font-mono);font-size:12px;color:${color}">${popupText(mark.waterLevel)} ซม.</span>
          </div>
          <div style="font-size:12px;color:var(--fg);line-height:1.45;margin-bottom:8px">${popupText(detail)}</div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:11.5px">
            <span style="color:var(--fg-subtle)">วันที่</span><span style="font-family:var(--font-mono)">${popupText(mark.dateSurvey)}</span>
            <span style="color:var(--fg-subtle)">ประเภท</span><span>${popupText(mark.affectedArea)}</span>
            <span style="color:var(--fg-subtle)">เครื่องมือ</span><span>${popupText(mark.tool)}</span>
            <span style="color:var(--fg-subtle)">ใกล้เคียง</span><span>${popupText(mark.placeAround)}</span>
          </div>
        </div>`,
        )
        .addTo(group)
    })
}

function renderUserFloodMarks(
  L: typeof import('leaflet'),
  group: import('leaflet').LayerGroup,
  marks: UserFloodMark[],
  opts: {
    sessionUserId?: string | null
    sessionRole?: string | null
    onDeleteMark?: (id: string) => void
  } = {},
) {
  group.clearLayers()
  const { sessionUserId, sessionRole, onDeleteMark } = opts

  marks.forEach((mark) => {
    const canDelete =
      !!onDeleteMark && (sessionRole === 'admin' || (!!sessionUserId && mark.createdBy === sessionUserId))
    const color = floodMarkColor(mark.level)
    const radius = Math.max(5, Math.min(10, 4.5 + mark.waterLevelCm / 45))
    const detail = mark.placeDetail ?? mark.placeAround ?? 'ไม่ระบุสถานที่'
    const observed = mark.observedAt
      ? new Date(mark.observedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
      : '-'

    // ขอบประ + สีตามระดับ — แยกจากหมุด CMU (เส้นทึบ)
    const marker = L.circleMarker([mark.lat, mark.lng], {
      radius,
      color,
      weight: 2,
      opacity: 0.95,
      dashArray: '3,3',
      fillColor: color,
      fillOpacity: 0.35,
    })
      .bindPopup(
        `<div style="min-width:220px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <span style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle)">Flood Mark · ผู้ใช้ปัก</span>
          ${mark.code ? `<span style="font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--fg)">${escapeHtml(mark.code)}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
          <span style="font-size:13px;font-weight:600;color:var(--fg)">ระดับ ${mark.level}</span>
          <span style="font-family:var(--font-mono);font-size:12px;color:${color}">${popupText(mark.waterLevelCm)} ซม.</span>
        </div>
        <div style="font-size:12px;color:var(--fg);line-height:1.45;margin-bottom:8px">${popupText(detail)}</div>
        ${mark.imageUrl ? `<a href="${escapeHtml(mark.imageUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(mark.imageUrl)}" alt="รูปจุดน้ำท่วม" style="display:block;width:100%;max-height:160px;object-fit:cover;border-radius:6px;border:1px solid var(--border);margin-bottom:8px" /></a>` : ''}
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:11.5px">
          <span style="color:var(--fg-subtle)">วันที่วัด</span><span style="font-family:var(--font-mono)">${escapeHtml(observed)}</span>
          <span style="color:var(--fg-subtle)">พื้นที่</span><span>${popupText([mark.tambon, mark.amphoe, mark.province].filter(Boolean).join(' · ') || null)}</span>
          <span style="color:var(--fg-subtle)">ใกล้เคียง</span><span>${popupText(mark.placeAround)}</span>
          <span style="color:var(--fg-subtle)">ติดต่อ</span><span style="font-family:var(--font-mono)">${popupText(mark.contactPhone)}</span>
        </div>
        ${canDelete ? `<button id="del-mark-${mark.id}" type="button" style="margin-top:10px;width:100%;padding:7px;border-radius:6px;border:1px solid var(--risk-flood);background:transparent;color:var(--risk-flood);font-size:11.5px;font-family:var(--font-sans);cursor:pointer">ลบหมุดนี้</button>` : ''}
      </div>`,
      )

    if (canDelete) {
      marker.on('popupopen', () => {
        setTimeout(() => {
          document
            .getElementById(`del-mark-${mark.id}`)
            ?.addEventListener('click', () => onDeleteMark!(mark.id), { once: true })
        }, 0)
      })
    }

    marker.addTo(group)
  })
}

function firstText(parent: Element, tag: string): string {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

function parseKmlCoordinates(value: string): [number, number][] {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => {
      const [lng, lat] = part.split(',').map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return [lat, lng] as [number, number]
    })
    .filter((point): point is [number, number] => point !== null)
}

function cmuPopup(label: string, meta: string, title: string, detail?: string): string {
  return `<div style="min-width:200px">
    <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">CMU Water Center · ${escapeHtml(meta)}</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:4px">${escapeHtml(title || label)}</div>
    ${detail ? `<div style="font-size:12px;color:var(--fg-muted);line-height:1.45">${escapeHtml(detail)}</div>` : ''}
  </div>`
}

function renderCmuKmlLayer(
  L: typeof import('leaflet'),
  group: import('leaflet').LayerGroup,
  xml: string,
  cfg: CmuFloodLayerConfig,
) {
  group.clearLayers()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const placemarks = Array.from(doc.getElementsByTagName('Placemark'))

  placemarks.forEach((placemark) => {
    const title = firstText(placemark, 'name') || cfg.label
    const detail = firstText(placemark, 'description')
    const popup = cmuPopup(cfg.label, cfg.meta, title, detail)
    const polygon = placemark.getElementsByTagName('Polygon')[0]
    const line = placemark.getElementsByTagName('LineString')[0]
    const point = placemark.getElementsByTagName('Point')[0]

    if (polygon) {
      const coords = parseKmlCoordinates(firstText(polygon, 'coordinates'))
      if (coords.length < 3) return
      L.polygon(coords, {
        color: cfg.color,
        weight: 1.3,
        opacity: 0.9,
        fillColor: cfg.color,
        fillOpacity: 0.45,
        pane: cfg.kind === 'flood' ? cfg.key : 'overlayPane',
      })
        .bindPopup(popup)
        .addTo(group)
      return
    }

    if (line) {
      const coords = parseKmlCoordinates(firstText(line, 'coordinates'))
      if (coords.length < 2) return
      L.polyline(coords, {
        color: cfg.color,
        weight: 2.2,
        opacity: 0.95,
      })
        .bindPopup(popup)
        .addTo(group)
      return
    }

    if (point) {
      const [coord] = parseKmlCoordinates(firstText(point, 'coordinates'))
      if (!coord) return
      L.circleMarker(coord, {
        radius: 5,
        color: cfg.color,
        weight: 1.5,
        fillColor: cfg.color,
        fillOpacity: 0.65,
      })
        .bindPopup(popup)
        .addTo(group)
    }
  })
}

function geoJsonTitle(properties: Record<string, unknown>, fallback: string): string {
  const value =
    properties.name ??
    properties.Name ??
    properties.NAME ??
    properties.title ??
    properties.Title ??
    properties.place ??
    properties.Place
  return value === undefined || value === null || value === '' ? fallback : String(value)
}

function geoJsonDetail(properties: Record<string, unknown>): string {
  return Object.entries(properties)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')
}

function renderCmuGeoJsonLayer(
  L: typeof import('leaflet'),
  group: import('leaflet').LayerGroup,
  geo: GeoJsonObject,
  cfg: CmuFloodLayerConfig,
) {
  group.clearLayers()
  L.geoJSON(geo, {
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: cfg.kind === 'pole' ? 4.5 : 6,
        color: cfg.color,
        weight: 1.5,
        opacity: 0.95,
        fillColor: cfg.color,
        fillOpacity: cfg.kind === 'pole' ? 0.5 : 0.72,
      }),
    style: () => ({
      color: cfg.color,
      weight: cfg.kind === 'river' ? 2.2 : 1.3,
      opacity: 0.9,
      fillColor: cfg.color,
      fillOpacity: 0.22,
    }),
    onEachFeature: (feature, layer) => {
      const properties = (feature.properties ?? {}) as Record<string, unknown>
      layer.bindPopup(
        cmuPopup(
          cfg.label,
          cfg.meta,
          geoJsonTitle(properties, cfg.label),
          geoJsonDetail(properties),
        ),
      )
    },
  }).addTo(group)
}

export function useShowRoute() {
  return useCallback(
    async (
      group: import('leaflet').LayerGroup,
      person: VulnerablePerson,
      infra: Infrastructure[],
    ) => {
      const L = (await import('leaflet')).default
      const shelters = infra.filter(
        (i) =>
          i.type === 'shelter' ||
          i.type === 'assembly' ||
          i.type === 'hospital' ||
          i.type === 'clinic',
      )
      const shelter = nearestShelter(person, shelters)
      if (!shelter) return
      const route = buildEvacRoute(person, shelter)
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
        .addTo(group)
    },
    [],
  )
}
