export type VulnerableType = 'bedridden' | 'elderly' | 'disabled' | 'pregnant'
export type RiskLevel = 'flood' | 'near' | 'safe'
export type InfraType =
  | 'hospital'
  | 'clinic'
  | 'shelter'
  | 'assembly'
  | 'temporary_health_post'
export type UserRole =
  | 'admin'
  | 'officer'
  | 'viewer'
  | 'eoc'
  | 'vhv'
  | 'ems'
  | 'rescue'
  | 'ddpm'
export type MedicalPriority = 'A' | 'B' | 'C'
export type FollowUpStatus =
  | 'pending'
  | 'contacted'
  | 'needs_help'
  | 'moved'
  | 'referred'
  | 'closed'
export type VisitStatus = 'pending' | 'completed' | 'unreachable' | 'needs_follow_up'
export type PersonFieldStatus = 'safe' | 'needs_help' | 'evacuated' | 'referred' | 'unknown'
export type HelpRequestType =
  | 'medical'
  | 'evacuation'
  | 'supplies'
  | 'rescue'
  | 'shelter'
  | 'other'
export type HelpRequestPriority = 'low' | 'normal' | 'high' | 'critical'
export type HelpRequestStatus =
  | 'new'
  | 'triaged'
  | 'assigned'
  | 'en_route'
  | 'resolved'
  | 'cancelled'
export type ShelterReadinessStatus = 'open' | 'near_capacity' | 'full' | 'closed' | 'unsafe'

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
  tambon?: string
  amphoe?: string
  fullAddress?: string
  lat: number
  lng: number
  eq?: string
  risk?: RiskLevel
  floodLevel?: 1 | 2 | 3 | 4 | 5 | null
  medicalPriority?: MedicalPriority
  followUpStatus?: FollowUpStatus
  careUnit?: string
  assignedVhvId?: string
  lastContactedAt?: string
  lastVisitedAt?: string
  lastKnownStatus?: string
}

export interface Infrastructure {
  id?: number
  name: string
  type: InfraType
  lat: number
  lng: number
  icon: string
  cap: string
  occupancy?: number
  readinessStatus?: ShelterReadinessStatus
  healthCapacity?: number
  bedriddenCapacity?: number
  wheelchairSupport?: boolean
  oxygenSupport?: boolean
  electricitySupport?: boolean
  waterSanitationStatus?: string
  healthResources?: Record<string, unknown>
}

export interface HealthVisit {
  id: string
  vulnerablePersonId?: string
  visitedBy?: string
  visitStatus: VisitStatus
  personStatus?: PersonFieldStatus
  needsHelp: boolean
  helpType?: string
  notes?: string
  lat?: number
  lng?: number
  observedAt: string
  syncedAt?: string
}

export interface HelpRequest {
  id: string
  vulnerablePersonId?: string
  requestedBy?: string
  sourceRole: UserRole | 'public'
  requestType: HelpRequestType
  priority: HelpRequestPriority
  status: HelpRequestStatus
  description?: string
  lat?: number
  lng?: number
  preferredShelterId?: string
  observedAt: string
  syncedAt?: string
}

export interface CaseAssignment {
  id: string
  helpRequestId: string
  assignedTo?: string
  assignedTeam?: string
  assignedBy?: string
  status: 'assigned' | 'accepted' | 'en_route' | 'arrived' | 'transferred' | 'closed'
  etaMinutes?: number
  notes?: string
  assignedAt: string
}

export interface ShelterStatusSnapshot {
  id: number
  shelterId: string
  occupancy: number
  capacity?: number
  readinessStatus: ShelterReadinessStatus
  healthResources?: Record<string, unknown>
  reportedBy?: string
  observedAt: string
  syncedAt?: string
}

export interface ShelterAdmission {
  id: string
  shelterId: string
  vulnerablePersonId?: string
  helpRequestId?: string
  admittedBy?: string
  status: 'admitted' | 'transferred' | 'discharged' | 'cancelled'
  needsFollowUp: boolean
  notes?: string
  admittedAt: string
  dischargedAt?: string
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

export type FloodMarkLevel = '1' | '2' | '3' | '4' | '5'
export type CmuFloodLayerKey =
  | 'flood1'
  | 'flood2'
  | 'flood3'
  | 'flood4'
  | 'flood5'
  | 'river'
  | 'parking'
  | 'shelter'
  | 'pole'
  | 's1a'

export type GistdaLayerKey =
  | 'flood1d'
  | 'flood3d'
  | 'flood7d'
  | 'flood30d'
  | 'floodFreq'
  | 'waterHyacinth'

export type GistdaLayers = Record<GistdaLayerKey, boolean>
export type FloodMarkLayers = Record<FloodMarkLevel, boolean>
export type CmuFloodLayers = Record<CmuFloodLayerKey, boolean>

export interface LayerState {
  gistda: GistdaLayers
  floodMarks: FloodMarkLayers
  cmuFlood: CmuFloodLayers
  vulnerable: boolean
  infra: boolean
  routes: boolean
}

export interface FloodMark {
  code: string
  dateSurvey: string | null
  affectedArea: string | null
  otherDetail: string | null
  placeDetail: string | null
  latitude: number
  longitude: number
  placeAround: string | null
  waterLevel: number | null
  tool: string | null
  toolDetail: string | null
  note: string | null
  image: string | null
  level: FloodMarkLevel
  province: string | null
}

export interface FloodMarkProvince {
  name: string
  count: number
  bounds: [[number, number], [number, number]]
}

export interface FloodMarkLevelConfig {
  key: FloodMarkLevel
  label: string
  meta: string
  color: string
}

export const FLOOD_MARK_LEVELS: FloodMarkLevelConfig[] = [
  {
    key: '1',
    label: 'Flood Mark ระดับ 1',
    meta: 'ระดับน้ำต่ำกว่า 50 ซม.',
    color: 'oklch(0.74 0.10 145)',
  },
  {
    key: '2',
    label: 'Flood Mark ระดับ 2',
    meta: 'ระดับน้ำ 50-100 ซม.',
    color: 'oklch(0.78 0.16 75)',
  },
  {
    key: '3',
    label: 'Flood Mark ระดับ 3',
    meta: 'ระดับน้ำ 100-150 ซม.',
    color: 'oklch(0.68 0.18 50)',
  },
  {
    key: '4',
    label: 'Flood Mark ระดับ 4',
    meta: 'ระดับน้ำ 150-200 ซม.',
    color: 'oklch(0.66 0.20 30)',
  },
  {
    key: '5',
    label: 'Flood Mark ระดับ 5',
    meta: 'ระดับน้ำมากกว่า 200 ซม.',
    color: 'oklch(0.54 0.22 25)',
  },
]

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

export interface CmuFloodLayerConfig {
  key: CmuFloodLayerKey
  label: string
  meta: string
  path: string
  format: 'kml' | 'geojson'
  kind: 'flood' | 'river' | 'parking' | 'shelter' | 'pole'
  color: string
}

export const CMU_FLOOD_LAYERS: CmuFloodLayerConfig[] = [
  {
    key: 'flood1',
    label: 'ขอบเขตน้ำท่วม ลำดับ 1',
    meta: 'P.1 = 4.30 ม. · KML Polygon',
    path: '/data/kml/L1.kml',
    format: 'kml',
    kind: 'flood',
    color: 'oklch(0.54 0.22 25)',
  },
  {
    key: 'flood2',
    label: 'ขอบเขตน้ำท่วม ลำดับ 2',
    meta: 'P.1 = 4.50 ม. · KML Polygon',
    path: '/data/kml/L2.kml',
    format: 'kml',
    kind: 'flood',
    color: 'oklch(0.66 0.20 30)',
  },
  {
    key: 'flood3',
    label: 'ขอบเขตน้ำท่วม ลำดับ 3',
    meta: 'P.1 = 4.70 ม. · KML Polygon',
    path: '/data/kml/L3new.kml',
    format: 'kml',
    kind: 'flood',
    color: 'oklch(0.68 0.18 50)',
  },
  {
    key: 'flood4',
    label: 'ขอบเขตน้ำท่วม ลำดับ 4',
    meta: 'P.1 = 5.00 ม. · KML Polygon',
    path: '/data/kml/L4new.kml',
    format: 'kml',
    kind: 'flood',
    color: 'oklch(0.72 0.17 62)',
  },
  {
    key: 'flood5',
    label: 'ขอบเขตน้ำท่วม ลำดับ 5',
    meta: 'P.1 = 5.30 ม. · KML Polygon',
    path: '/data/kml/L5.kml',
    format: 'kml',
    kind: 'flood',
    color: 'oklch(0.78 0.16 75)',
  },
  {
    key: 'river',
    label: 'แม่น้ำ / ลำน้ำหลัก',
    meta: 'CNX Stream · KML LineString',
    path: 'data/KML/river_main.kml',
    format: 'kml',
    kind: 'river',
    color: 'oklch(0.68 0.15 230)',
  },
  {
    key: 'parking',
    label: 'จุดจอดรถกรณีน้ำท่วม',
    meta: 'ประมาณ 19 จุด · GeoJSON',
    path: 'data/parking_flood.geojson',
    format: 'geojson',
    kind: 'parking',
    color: 'oklch(0.78 0.16 75)',
  },
  {
    key: 'shelter',
    label: 'ศูนย์พักพิงชั่วคราว',
    meta: 'ประมาณ 39 จุด · GeoJSON',
    path: 'data/Shelter.geojson',
    format: 'geojson',
    kind: 'shelter',
    color: 'oklch(0.74 0.10 145)',
  },
  {
    key: 'pole',
    label: 'หลักเตือนระดับน้ำท่วม',
    meta: 'P.1 สะพานนวรัฐ · GeoJSON',
    path: 'data/PoleCNX2025_v2.geojson',
    format: 'geojson',
    kind: 'pole',
    color: 'oklch(0.62 0.18 305)',
  },
  {
    key: 's1a',
    label: 'พื้นที่น้ำท่วมดาวเทียม S2C',
    meta: 'S2C_20250724_1036 · KML',
    path: '/data/kml/S2C_20250724_1036.kml',
    format: 'kml',
    kind: 'flood',
    color: 'oklch(0.55 0.25 260)',
  },
]

export type BasemapType = 'sat' | 'street' | 'topo' | 'hybrid' | 'google' | 'google_sat'

export interface EvacRoute {
  personId: number
  personName: string
  shelterName: string
  distanceKm: number
  coords: [number, number][]
  durationMin?: number
  isStraightLine?: boolean
}

export interface ApiResponse<T> {
  data: T
  error?: string
}
