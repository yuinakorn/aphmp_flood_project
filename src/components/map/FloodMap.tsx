'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import type {
  Map as LeafletMap,
  LayerGroup,
  TileLayer,
  GeoJSON,
  CircleMarker,
} from 'leaflet'
import type {
  BasemapType,
  LayerState,
  VulnerablePerson,
  Infrastructure,
  EvacRoute,
  RiskLevel,
} from '@/types'
import { buildEvacRoute, nearestShelter } from '@/lib/geo'

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
  radius: number
  heatRadius: number
  opacity: number
  basemap: BasemapType
  onMapReady?: (map: LeafletMap) => void
  onRequestRoute?: (personId: number) => void
}

export function FloodMap({
  layers,
  vulnerable,
  infra,
  radius,
  heatRadius,
  opacity,
  basemap,
  onMapReady,
  onRequestRoute,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const baseLayers = useRef<TileLayer[]>([])
  const heatLayerRef = useRef<any>(null)
  const circleGroupRef = useRef<LayerGroup | null>(null)
  const circleMarkersRef = useRef<CircleMarker[]>([])
  const s2LayerRef = useRef<GeoJSON | null>(null)
  const vulnGroupRef = useRef<LayerGroup | null>(null)
  const infraGroupRef = useRef<LayerGroup | null>(null)
  const routeGroupRef = useRef<LayerGroup | null>(null)
  const gistdaRef = useRef<TileLayer.WMS | null>(null)
  const [floodPoints, setFloodPoints] = useState<[number, number, number][]>([])
  const [mapReady, setMapReady] = useState(false)

  // Init Leaflet
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    let isMounted = true
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.heat')

      if (!isMounted || !containerRef.current) return

      const container = containerRef.current
      if ((container as any)._leaflet_id) {
        (container as any)._leaflet_id = null
      }

      const map = L.map(container, {
        center: [18.78, 100.78],
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

      const res = await fetch('/api/flood-points')
      const geojson = await res.json()
      const pts: [number, number, number][] = geojson.features.map((f: any) => [
        f.geometry.coordinates[1],
        f.geometry.coordinates[0],
        f.properties.intensity * 0.5,
      ])
      setFloodPoints(pts)

      // Heatmap with risk palette (amber → orange → red)
      const heat = (L as any)
        .heatLayer(pts, {
          radius: 18,
          blur: 14,
          maxZoom: 14,
          max: 3,
          gradient: {
            0.2: 'oklch(0.78 0.16 75)',
            0.5: 'oklch(0.68 0.18 50)',
            0.75: 'oklch(0.66 0.20 30)',
            1.0: 'oklch(0.54 0.22 25)',
          },
        })
        .addTo(map)
      heatLayerRef.current = heat

      const cg = L.layerGroup().addTo(map)
      circleGroupRef.current = cg
      renderCircles(L, cg, pts, 300, 0.45)

      const s2Res = await fetch('/api/flood-polygons')
      const s2Data = await s2Res.json()
      const s2Layer = L.geoJSON(s2Data, {
        style: () => ({
          color: 'oklch(0.68 0.15 230)',
          weight: 1.25,
          fillColor: 'oklch(0.68 0.15 230)',
          fillOpacity: 0.22,
          opacity: 0.9,
        }),
        onEachFeature: (f, layer) => {
          const name = f.properties?.name || 'พื้นที่น้ำท่วม'
          layer.bindPopup(
            `<div>
              <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-subtle);margin-bottom:4px">Sentinel-2 polygon</div>
              <div style="font-size:14px;font-weight:600;margin-bottom:6px">${name}</div>
              <div style="font-size:11px;color:var(--fg-muted);font-family:var(--font-mono)">2025-07-24 10:36 UTC</div>
            </div>`,
          )
          layer.on('mouseover', () =>
            (layer as any).setStyle({ weight: 2.5, fillOpacity: 0.35 }),
          )
          layer.on('mouseout', () =>
            (layer as any).setStyle({ weight: 1.25, fillOpacity: 0.22 }),
          )
        },
      }).addTo(map)
      s2LayerRef.current = s2Layer

      vulnGroupRef.current = L.layerGroup().addTo(map)
      infraGroupRef.current = L.layerGroup().addTo(map)
      routeGroupRef.current = L.layerGroup().addTo(map)

      const gistda = L.tileLayer.wms('https://flood.gistda.or.th/geoserver/flood/wms', {
        layers: 'flood:flood_2024_geo',
        transparent: true,
        format: 'image/png',
        opacity: 0.5,
      })
      gistdaRef.current = gistda

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
    ;(async () => {
      const L = (await import('leaflet')).default
      const vg = vulnGroupRef.current!
      vg.clearLayers()

      vulnerable.forEach((p) => {
        const risk: RiskLevel = (p.risk ?? 'safe') as RiskLevel
        const ringColor = RISK_COLOR[risk]
        const fillColor = TYPE_COLOR[p.type] ?? 'var(--fg-muted)'
        const size = risk === 'flood' ? 6 : risk === 'near' ? 5 : 4

        const marker = L.circleMarker([p.lat, p.lng], {
          radius: size,
          color: ringColor,
          weight: 2,
          fillColor,
          fillOpacity: 0.95,
          opacity: 1,
        })

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
              <span style="color:var(--fg-subtle)">อายุ</span><span style="font-family:var(--font-mono)">${p.age} ปี</span>
              <span style="color:var(--fg-subtle)">ภาวะ</span><span>${p.cond}</span>
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
    ;(async () => {
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

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const toggle = (layer: any, on: boolean) => {
      if (!layer) return
      if (on && !map.hasLayer(layer)) map.addLayer(layer)
      if (!on && map.hasLayer(layer)) map.removeLayer(layer)
    }
    toggle(heatLayerRef.current, layers.heatmap)
    toggle(circleGroupRef.current, layers.circles)
    toggle(s2LayerRef.current, layers.s2flood)
    toggle(vulnGroupRef.current, layers.vulnerable)
    toggle(infraGroupRef.current, layers.infra)
    toggle(routeGroupRef.current, layers.routes)
    toggle(gistdaRef.current, layers.gistda)
  }, [layers])

  // Tune sliders
  useEffect(() => {
    if (!circleGroupRef.current || !floodPoints.length) return
    ;(async () => {
      const L = (await import('leaflet')).default
      renderCircles(L, circleGroupRef.current!, floodPoints, radius, opacity / 100)
    })()
  }, [radius, opacity, floodPoints])

  useEffect(() => {
    if (!heatLayerRef.current) return
    heatLayerRef.current.setOptions({ radius: heatRadius })
  }, [heatRadius])

  // Basemap switching
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    ;(async () => {
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

function renderCircles(
  L: typeof import('leaflet'),
  group: import('leaflet').LayerGroup,
  points: [number, number, number][],
  radius: number,
  fillOpacity: number,
) {
  group.clearLayers()
  points.forEach(([lat, lng]) => {
    L.circle([lat, lng], {
      radius,
      color: 'oklch(0.66 0.20 30)',
      weight: 1,
      opacity: 0.55,
      fillColor: 'oklch(0.66 0.20 30)',
      fillOpacity,
    }).addTo(group)
  })
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
