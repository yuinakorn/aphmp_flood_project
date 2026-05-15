'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import type {
  Map as LeafletMap,
  Layer,
  LayerGroup,
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
  VulnerablePerson,
  Infrastructure,
  RiskLevel,
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

const TYPE_COLOR: Record<string, string> = {
  bedridden: 'oklch(0.66 0.20 30)',
  elderly: 'oklch(0.78 0.16 75)',
  disabled: 'oklch(0.62 0.18 305)',
  pregnant: 'oklch(0.72 0.14 350)',
}

const INFRA_COLOR: Record<string, string> = {
  hospital: 'oklch(0.74 0.10 145)',
  clinic: 'oklch(0.74 0.10 145)',
  shelter: 'oklch(0.68 0.15 230)',
  assembly: 'oklch(0.68 0.15 230)',
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

const VULN_SVG: Record<string, string> = {
  bedridden: `<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>`,
  elderly: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  disabled: `<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>`,
  pregnant: `<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>`,
}

function vulnMarkerHtml(type: string, risk: RiskLevel): string {
  const tone = TYPE_COLOR[type] ?? 'var(--fg-muted)'
  const ringColor = RISK_COLOR[risk] ?? 'var(--border)'
  const svg = VULN_SVG[type] ?? VULN_SVG.elderly
  return `
    <div style="
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      border-radius:50%;
      background:color-mix(in oklch, ${tone} 20%, var(--bg-elevated));
      border:2.5px solid ${ringColor};
      box-shadow:0 2px 6px oklch(0 0 0 / 0.45);
      color:${tone};
    ">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >${svg}</svg>
    </div>
  `
}

function infraMarkerHtml(type: string): string {
  const tone = INFRA_COLOR[type] ?? 'var(--accent)'
  const svg = INFRA_SVG[type] ?? ''
  return `
    <div style="
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      border-radius:6px;
      background:color-mix(in oklch, ${tone} 18%, var(--bg-elevated));
      border:1.5px solid ${tone};
      box-shadow:0 2px 6px oklch(0 0 0 / 0.45);
      color:${tone};
    ">
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
  google: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
  google_sat: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
}

interface Props {
  layers: LayerState
  vulnerable: VulnerablePerson[]
  infra: Infrastructure[]
  basemap: BasemapType
  floodMarkProvince: string | null
  onMapReady?: (map: LeafletMap) => void
  onRequestRoute?: (personId: number) => void
}

export function FloodMap({
  layers,
  vulnerable,
  infra,
  basemap,
  floodMarkProvince,
  onMapReady,
  onRequestRoute,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const baseLayers = useRef<TileLayer[]>([])
  const vulnGroupRef = useRef<LayerGroup | null>(null)
  const infraGroupRef = useRef<LayerGroup | null>(null)
  const routeGroupRef = useRef<LayerGroup | null>(null)
  const gistdaRefs = useRef<Partial<Record<GistdaLayerKey, TileLayer>>>({})
  const floodMarkGroupRefs = useRef<Partial<Record<FloodMarkLevel, LayerGroup>>>({})
  const floodMarkCacheRef = useRef<Partial<Record<FloodMarkLevel, FloodMark[]>>>({})
  const cmuFloodGroupRefs = useRef<Partial<Record<CmuFloodLayerKey, LayerGroup>>>({})
  const cmuFloodLoadedRef = useRef<Partial<Record<CmuFloodLayerKey, boolean>>>({})
  const [mapReady, setMapReady] = useState(false)

  // Init Leaflet
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    let isMounted = true
      ; (async () => {
        const L = (await import('leaflet')).default
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

        vulnGroupRef.current = L.layerGroup().addTo(map)
        infraGroupRef.current = L.layerGroup().addTo(map)
        routeGroupRef.current = L.layerGroup().addTo(map)
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

  // Vulnerable markers (vector circleMarker, not div-icon)
  useEffect(() => {
    if (!mapReady || !vulnGroupRef.current) return
      ; (async () => {
        const L = (await import('leaflet')).default
        const vg = vulnGroupRef.current!
        vg.clearLayers()

        vulnerable.forEach((p) => {
          const risk: RiskLevel = (p.risk ?? 'safe') as RiskLevel
          const ringColor = RISK_COLOR[risk]

          const icon = L.divIcon({
            className: 'vuln-marker',
            html: vulnMarkerHtml(p.type, risk),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })

          const marker = L.marker([p.lat, p.lng], { icon })

          const riskLabel: Record<RiskLevel, string> = {
            flood: 'ในเขตน้ำท่วม',
            near: 'ใกล้เขต',
            safe: 'ปลอดภัย',
          }

          marker.bindPopup(
            `<div style="min-width:200px">
            <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">${p.label}</div>
            <div style="font-size:14px;font-weight:600;color:var(--fg);margin-bottom:8px">${p.name}</div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;margin-bottom:10px">
              ${p.age !== undefined ? `<span style="color:var(--fg-subtle)">อายุ</span><span style="font-family:var(--font-mono)">${p.age} ปี</span>` : ''}
              ${p.cond !== undefined ? `<span style="color:var(--fg-subtle)">ภาวะ</span><span>${p.cond}</span>` : ''}
              <span style="color:var(--fg-subtle)">หมู่บ้าน</span><span>${p.vil}</span>
              ${p.eq ? `<span style="color:var(--fg-subtle)">อุปกรณ์</span><span>${p.eq}</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center;padding:5px 8px;border-radius:6px;background:color-mix(in oklch, ${ringColor} 14%, transparent);color:${ringColor};font-size:11px;font-weight:500;margin-bottom:8px">
              <span style="width:6px;height:6px;border-radius:50%;background:${ringColor}"></span>
              ${riskLabel[risk]}
            </div>
            <button id="evac-${p.id}" style="width:100%;padding:7px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:11.5px;font-family:var(--font-sans);cursor:pointer">
              แสดงเส้นทางอพยพ →
            </button>
          </div>`,
          )

          marker.on('popupopen', () => {
            setTimeout(() => {
              const btn = document.getElementById(`evac-${p.id}`)
              btn?.addEventListener(
                'click',
                () => onRequestRoute?.(p.id),
                { once: true },
              )
            }, 0)
          })

          vg.addLayer(marker)
        })
      })()
  }, [mapReady, vulnerable, onRequestRoute])

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
          L.marker([i.lat, i.lng], { icon })
            .bindPopup(
              `<div>
              <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">${INFRA_LABEL[i.type] ?? i.type}</div>
              <div style="font-size:14px;font-weight:600;margin-bottom:4px">${i.name}</div>
              <div style="font-size:12px;color:var(--fg-muted)">ความจุ: <span style="font-family:var(--font-mono)">${i.cap}</span></div>
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
              const res = await fetch(`/api/cmu-flood/${cfg.path}`)
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
        (i) => i.type === 'shelter' || i.type === 'assembly',
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
