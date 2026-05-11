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

export interface LayerState {
  heatmap: boolean
  circles: boolean
  gistda: boolean
  s2flood: boolean
  vulnerable: boolean
  infra: boolean
  routes: boolean
}

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
