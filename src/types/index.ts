export type VulnerableType = 'bedridden' | 'elderly' | 'disabled' | 'pregnant'
export type RiskLevel = 'flood' | 'near' | 'safe'
export type InfraType = 'hospital' | 'clinic' | 'shelter' | 'assembly'
export type UserRole = 'admin' | 'officer' | 'viewer'

export interface FloodPoint {
  lat: number
  lng: number
  intensity: number
}

export interface VulnerablePerson {
  id: number
  name: string
  type: VulnerableType
  label: string
  age: number
  cond: string
  vil: string
  lat: number
  lng: number
  eq?: string
  risk?: RiskLevel
}

export interface Infrastructure {
  id?: number
  name: string
  type: InfraType
  lat: number
  lng: number
  icon: string
  cap: string
}

export interface FloodStats {
  total: number
  areaSqKm: number
  sarPasses: number
  baselinePasses: number
}

export interface VulnerableStats {
  flood: number
  near: number
  safe: number
  total: number
}

export type FloodPeriod = '1day' | '3days' | '7days' | '30days'

export const FLOOD_PERIODS: { key: FloodPeriod; label: string }[] = [
  { key: '1day', label: '1 วันล่าสุด' },
  { key: '3days', label: '3 วันล่าสุด' },
  { key: '7days', label: '7 วันล่าสุด' },
  { key: '30days', label: '30 วันล่าสุด' },
]

export type GistdaLayerKey =
  | 'flood1d'
  | 'flood3d'
  | 'flood7d'
  | 'flood30d'
  | 'floodFreq'
  | 'waterHyacinth'

export type GistdaLayers = Record<GistdaLayerKey, boolean>

export interface LayerState {
  heatmap: boolean
  circles: boolean
  gistda: GistdaLayers
  s2flood: boolean
  vulnerable: boolean
  infra: boolean
  routes: boolean
}

export interface GistdaLayerConfig {
  key: GistdaLayerKey
  label: string
  meta: string
  /** path under `/api/gistda/maps/` for TMS tiles */
  tmsPath: string
}

export const GISTDA_LAYERS: GistdaLayerConfig[] = [
  {
    key: 'flood1d',
    label: 'น้ำท่วม 1 วันล่าสุด',
    meta: 'flood/1day · TMS',
    tmsPath: 'flood/1day',
  },
  {
    key: 'flood3d',
    label: 'น้ำท่วม 3 วันล่าสุด',
    meta: 'flood/3days · TMS',
    tmsPath: 'flood/3days',
  },
  {
    key: 'flood7d',
    label: 'น้ำท่วม 7 วันล่าสุด',
    meta: 'flood/7days · TMS',
    tmsPath: 'flood/7days',
  },
  {
    key: 'flood30d',
    label: 'น้ำท่วม 30 วันล่าสุด',
    meta: 'flood/30days · TMS',
    tmsPath: 'flood/30days',
  },
  {
    key: 'floodFreq',
    label: 'ความถี่พื้นที่น้ำท่วมซ้ำซาก',
    meta: 'flood-freq · TMS',
    tmsPath: 'flood-freq',
  },
  {
    key: 'waterHyacinth',
    label: 'ผักตบชวา',
    meta: 'water_hyacinth · TMS',
    tmsPath: 'water_hyacinth',
  },
]

export type BasemapType = 'sat' | 'street' | 'topo' | 'hybrid' | 'google' | 'google_sat'

export interface EvacRoute {
  personId: number
  personName: string
  shelterName: string
  distanceKm: number
  coords: [number, number][]
}

export interface ApiResponse<T> {
  data: T
  error?: string
}
