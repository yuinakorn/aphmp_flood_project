export type VulnerableType = 'bedridden' | 'elderly' | 'disabled' | 'pregnant' | 'other'

// ป้ายประเภทกลุ่มเปราะบาง (แหล่งความจริงเดียว ใช้ทั้งฟอร์ม/ตัวกรอง/แสดงผล)
export const VULNERABLE_TYPE_LABEL: Record<VulnerableType, string> = {
  bedridden: 'ติดเตียง',
  elderly: 'ผู้สูงอายุติดบ้าน',
  disabled: 'พิการ',
  pregnant: 'ตั้งครรภ์',
  other: 'อื่น ๆ',
}
export type RiskLevel = 'flood' | 'near' | 'safe'
export type InfraType =
  | 'hospital'
  | 'clinic'
  | 'shelter'
  | 'assembly'
  | 'temporary_health_post'
  | 'evacuation_point'
export type UserRole =
  | 'admin'
  | 'officer'
  | 'viewer'
  | 'eoc'
  | 'vhv'
  | 'ems'
  | 'rescue'
  | 'ddpm'
  | 'shelter_manager'
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
// สถานะการกระจายตัวของคนในเหตุการณ์ (disposition funnel) — derive ตาม EOC-KPI-DISPOSITION-SPEC §3.2
export type IncidentDisposition = 'safe' | 'at_home' | 'in_transit' | 'referred' | 'unreachable'
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
/** คำร้องจากประชาชน (ฟอร์มสาธารณะ) — ยังไม่ยืนยันตัวตน รอ จนท. ตรวจสอบ */
export type PublicReportStatus = 'pending' | 'approved' | 'rejected'
export interface PublicHelpReport {
  id: string
  reporterName: string | null
  reporterPhone: string
  requestType: HelpRequestType
  description: string | null
  peopleCount: number | null
  province: string | null
  addressText: string | null
  lat: number | null
  lng: number | null
  status: PublicReportStatus
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  helpRequestId: string | null
  incidentId: string | null
  createdAt: string | null
}

export type ShelterReadinessStatus = 'open' | 'near_capacity' | 'full' | 'closed' | 'unsafe'
export type IncidentType = 'flood' | 'storm' | 'other'
export type IncidentStatus = 'active' | 'monitoring' | 'closed'

/** พื้นที่ผลกระทบหนึ่งของเหตุการณ์ — hierarchical: tambon=null=ทั้งอำเภอ, amphoe=null=ทั้งจังหวัด */
export interface IncidentArea {
  id?: string
  province?: string | null
  amphoe?: string | null
  tambon?: string | null
}

export interface Incident {
  id: string
  name: string
  type: IncidentType
  status: IncidentStatus
  province?: string | null   // พื้นที่หลัก (display + province guard)
  amphoe?: string | null
  tambon?: string | null
  areas?: IncidentArea[]      // พื้นที่ผลกระทบทั้งหมด (scope จริงในการกรองข้อมูล) — multi-อำเภอ/ตำบล
  description?: string | null
  startedAt: string
  endedAt?: string | null
  createdBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface CoverageRow {
  amphoe: string
  tambon: string
  vil: string
  totalMembers: number
  visitedIn90d: number
  pct90d: number            // 0–100
  lastVisitAt: string | null // ISO
  daysSinceLastVisit: number | null
}

export interface FloodPoint {
  lat: number
  lng: number
  intensity: number
}

// ───────── Phase E: Operations counters + surveillance ─────────
export type CasualtyType = 'injured' | 'dead' | 'missing' | 'ill'
export type CasualtySeverity = 'minor' | 'moderate' | 'severe'
export type CasualtyCause = 'drowning' | 'electrocution' | 'trauma' | 'disease' | 'other'

export const CASUALTY_TYPE_LABEL: Record<CasualtyType, string> = {
  injured: 'บาดเจ็บ',
  dead: 'เสียชีวิต',
  missing: 'สูญหาย',
  ill: 'เจ็บป่วย',
}
export const CASUALTY_CAUSE_LABEL: Record<CasualtyCause, string> = {
  drowning: 'จมน้ำ',
  electrocution: 'ไฟดูด',
  trauma: 'บาดเจ็บ/อุบัติเหตุ',
  disease: 'โรค/ภาวะสุขภาพ',
  other: 'อื่นๆ',
}

export interface IncidentCasualty {
  id: string
  incidentId: string
  memberId?: string | null
  casualtyType: CasualtyType
  severity?: CasualtySeverity | null
  personName?: string | null
  age?: number | null
  sex?: string | null
  cause?: CasualtyCause | null
  tambon?: string | null
  amphoe?: string | null
  notes?: string | null
  observedAt: string
  createdAt?: string | null
}

export type SurveillanceDiseaseCode =
  | 'foot_immersion'
  | 'diarrhea'
  | 'fever'
  | 'conjunctivitis'
  | 'respiratory'
  | 'stress'
  | 'leptospirosis'
  | 'other'

export const SURVEILLANCE_DISEASE_LABEL: Record<SurveillanceDiseaseCode, string> = {
  foot_immersion: 'น้ำกัดเท้า',
  diarrhea: 'อุจจาระร่วง',
  fever: 'ไข้/ไข้หวัด',
  conjunctivitis: 'ตาแดง',
  respiratory: 'ระบบทางเดินหายใจ',
  stress: 'ความเครียด/สุขภาพจิต',
  leptospirosis: 'ฉี่หนู (เลปโตสไปโรซิส)',
  other: 'อื่นๆ',
}

export interface SurveillanceEntry {
  id: string
  incidentId: string
  diseaseCode: SurveillanceDiseaseCode
  diseaseLabel?: string | null
  caseCount: number
  reportDate: string
  tambon?: string | null
  amphoe?: string | null
  shelterId?: string | null
  notes?: string | null
  createdAt?: string | null
}

// ───────── Phase F: Situation Report ─────────
export interface TodayCumulative {
  today: number
  cumulative: number
}

// ตัวเลขที่กรอกเอง (manual) — เก็บใน sit_reports.manual (JSONB)
export interface SitRepManual {
  affectedTambonCount?: number | null   // override จำนวนตำบลที่มีสถานการณ์
  // สถานบริการสาธารณสุขที่ได้รับผลกระทบ
  rpstAffected?: number       // รพ.สต.
  hospitalAffected?: number   // รพ.
  facilitiesClosed?: number   // ปิดบริการ
  facilitiesPartial?: number  // เปิดบางส่วน
  // การสนับสนุน
  mobileUnitDispatch?: number // สนับสนุนออกหน่วย (จำนวนการ)
  woundKits?: number          // ชุดทำแผล
  floodMedKits?: number       // ชุดยาน้ำท่วม
  staffAffected?: number      // บุคลากรสาธารณสุขที่กระทบ (ราย)
  chronicMedItems?: number    // ยาโรคเรื้อรัง (รายการ)
  chronicMedUnits?: number    // ยาโรคเรื้อรัง (หน่วย)
  // ทีมปฏิบัติการฉุกเฉินทางการแพทย์
  teams?: {
    mert?: number
    miniMert?: number
    mobileMed?: number   // หน่วยแพทย์เคลื่อนที่
    mcatt?: number
    sehrt?: number
    cdcu?: number
    srrt?: number
    other?: number
  }
  // ผู้รับบริการด้านการแพทย์รวม
  services?: {
    homeVisit?: number     // เยี่ยมบ้าน (prefill จาก auto ได้)
    supplies?: number      // แจกจ่ายเวชภัณฑ์
    treatment?: number     // ตรวจรักษา
    healthEdu?: number     // ให้สุขศึกษา
    mentalHealth?: number  // สุขภาพจิต
    referRpst?: number      // ส่งต่อ รพ.สต.
    referHospital?: number  // ส่งต่อ รพ.
  }
}

// ตัวเลขที่ระบบคำนวณให้ (auto)
export interface SitRepAuto {
  casualties: {
    dead: TodayCumulative
    missing: TodayCumulative
    injured: TodayCumulative
    ill: TodayCumulative
    total: TodayCumulative
  }
  householdsVisited: number   // ครัวเรือนที่ได้รับการเยี่ยม (สะสม)
  visitsToday: number
  sheltersUsed: number
  shelterNames: string[]
  shelterCurrent: number      // ผู้พักปัจจุบัน
  surveillance: { code: SurveillanceDiseaseCode; label: string; today: number; cumulative: number }[]
  affectedTambons: string[]
}

export interface SitReport {
  id: string
  incidentId: string
  reportDate: string
  reportTime?: string | null
  status: 'draft' | 'published'
  manual: SitRepManual
  measures?: string | null
  planNote?: string | null
  updatedAt?: string | null
}

export interface IncidentCounters {
  teams: { total: number; active: number; standby: number; offline: number }
  dispatches: { total: number; open: number; closed: number }
  services: { visits: number; completed: number; needsHelp: number }
  requests: { total: number; open: number; resolved: number; critical: number }
  shelters: {
    sheltersUsed: number
    current: number
    cumulative: number
    discharged: number
    toHospital: number
  }
  casualties: { injured: number; dead: number; missing: number; ill: number }
  surveillance: {
    totalCases: number
    byDisease: { code: SurveillanceDiseaseCode; label: string; cases: number }[]
  }
}

// สรุป disposition funnel (โหมดวิกฤต) — bucket รวม = total เสมอ; casualties เป็นคนละแกน (ใช้ IncidentCounters.casualties)
export interface DispositionSummary {
  total: number
  safe: number
  atHome: number
  inTransit: number
  referred: number
  unreachable: number
}

export interface VulnerablePerson {
  id: number
  householdId?: string | null  // UUID ของครัวเรือน — ใช้เปิด popup หมุดบ้านเมื่อเลือกจากรายชื่อ
  name: string
  nationalId?: string | null  // masked (เห็นเฉพาะ 4 หลักท้าย) — server mask ตาม PDPA
  type: VulnerableType
  label: string
  age: number
  cond: string
  vil: string
  tambon?: string
  amphoe?: string
  province?: string
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
  lifeSupport?: string[] | null
  disposition?: IncidentDisposition  // โหมดวิกฤตเท่านั้น — derive ใน page.tsx จาก incident-disposition
  isAdmitted?: boolean
  shelterName?: string | null
}

export interface HouseholdMapMember {
  name?: string
  age?: number
  sex?: 'ชาย' | 'หญิง' | '-'
  position?: string
  group: 'ผู้สูงอายุ' | 'เด็กเล็ก' | 'ผู้พิการ' | 'โรคเรื้อรัง' | 'ทั่วไป'
  /** หมวดเปราะบางละเอียด (ระดับคน) สำหรับตัวกรองแผนที่ — bedridden|dialysis|oxygen|disabled|pregnant|elderly|child */
  categories?: string[]
  /** ระดับความเร่งด่วนทางการแพทย์ A/B/C — A = วิกฤต (popup ต้องอธิบายเหตุผล) */
  medicalPriority?: MedicalPriority
  /** อุปกรณ์พยุงชีพที่ใช้ — เหตุผลหลักที่จัดเป็นกลุ่มวิกฤต (oxygen|ventilator|dialysis_*|...) */
  lifeSupport?: string[] | null
  isHead?: boolean
  isVulnerable: boolean
  phone?: string | null
  shelterId?: string | null
  shelterName?: string | null
}

// โซนพื้นที่เสี่ยงภัย — polygon ที่เจ้าหน้าที่วาดเพื่อระบุพื้นที่เสี่ยง (เก็บ [lng, lat][])
// category: permanent (ถาวร เช่น น้ำท่วม) / temporary (ชั่วคราว เช่น แผ่นดินไหว โรคระบาด)
// hazardType: code ของชนิดภัย (ตั้งค่าได้ที่ตาราง hazard_types) — ดู src/lib/risk-zone.ts
// hazardLabel/Color/Emoji: denormalize จาก hazard_types เพื่อแสดงผลโดยไม่ต้อง fetch แยก
export interface FloodRiskZone {
  id: string
  province: string
  name: string
  category: 'permanent' | 'temporary'
  hazardType: string
  hazardLabel?: string
  hazardColor?: string
  hazardEmoji?: string
  color?: string | null // สีที่ผู้วาดเลือกเอง (override) — null = ใช้สีตามชนิดภัย/ลำดับ
  priority: number // 1 = เร่งด่วนสุด
  polygon: [number, number][] // [lng, lat][]
  notes?: string | null
  createdAt?: string | null
}

// หมุด "บ้าน" บนแผนที่ — popup แสดงสมาชิกทุกคน + เบอร์ (ฟิลด์ส่วนตัวอาจหายไปตาม PDPA role)
export interface VulnerableHouseholdMarker {
  id: string
  hno?: string
  village: string
  villno: string
  tambon?: string | null
  amphoe?: string | null
  province?: string | null
  lat: number
  lng: number
  vulnerableCount: number
  memberCount?: number
  risk?: RiskLevel
  members: HouseholdMapMember[]
}

export interface Infrastructure {
  id?: number | string
  name: string
  type: InfraType
  lat: number | string
  lng: number | string
  icon?: string
  cap?: string            // legacy static JSON field
  capacity?: number | null // DB field (แทน cap)
  occupancy?: number
  readinessStatus?: ShelterReadinessStatus
  healthCapacity?: number
  bedriddenCapacity?: number | null
  wheelchairSupport?: boolean
  oxygenSupport?: boolean
  electricitySupport?: boolean
  waterSanitationStatus?: string
  healthResources?: Record<string, unknown>
  province?: string | null
  amphoe?: string | null
  tambon?: string | null
  contact?: string | null
  accessModes?: string[] | null // จุดรับ-ส่งอพยพ: ['vehicle','boat','foot']
}

export type VitalStatus = 'normal' | 'monitoring' | 'unstable'
export type MentalStatus = 'good' | 'anxiety'

export interface HealthVisit {
  id: string
  incidentId?: string | null
  memberId?: string
  visitedBy?: string
  visitStatus: VisitStatus
  personStatus?: PersonFieldStatus
  needsHelp: boolean
  helpType?: string
  vitalStatus?: VitalStatus
  mentalStatus?: MentalStatus
  needsMcat: boolean
  medSufficient?: boolean
  oxygenReady?: boolean
  notes?: string
  lat?: number
  lng?: number
  observedAt: string
  syncedAt?: string
}

export type RescueTeamType =
  | 'rescue_boat'
  | 'gmc_truck'
  | 'ems_medical'
  | 'mcat_psych'
  | 'volunteer_kitchen'
  | 'other'
export type RescueTeamStatus = 'active' | 'standby' | 'offline'

export interface RescueTeam {
  id: string
  incidentId?: string | null
  name: string
  teamType: RescueTeamType
  contact?: string
  zone?: string
  status: RescueTeamStatus
  lat?: number
  lng?: number
  registeredBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface HelpRequest {
  id: string
  incidentId?: string | null
  memberId?: string
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
  rescueTeamId?: string
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

export type AdmissionStatus = 'admitted' | 'transferred' | 'discharged' | 'cancelled'
export type AdmissionExitReason =
  | 'moved_home'
  | 'moved_relative'
  | 'admitted_hospital'
  | 'transferred_shelter'
  | 'self_discharge'
  | 'lost_contact'
  | 'deceased'
  | 'other'

// ป้ายกำกับเหตุผลออกจากศูนย์ (แหล่งความจริงเดียว ใช้ทั้ง UI/validation/export)
export const EXIT_REASON_LABEL: Record<AdmissionExitReason, string> = {
  moved_home: 'กลับบ้าน (น้ำลด/ปลอดภัย)',
  moved_relative: 'ไปพักบ้านญาติ/คนรู้จัก',
  admitted_hospital: 'ส่งต่อโรงพยาบาล',
  transferred_shelter: 'ย้ายไปศูนย์พักพิงอื่น',
  self_discharge: 'ขอออกเอง',
  lost_contact: 'ออกเอง/ติดต่อไม่ได้',
  deceased: 'เสียชีวิต',
  other: 'อื่น ๆ',
}

// ตัวเลือกเหตุผลสำหรับปุ่ม "ย้ายออก" (ไม่รวมส่ง รพ. ซึ่งเป็นอีก flow)
export const DISCHARGE_REASONS: { code: Exclude<AdmissionExitReason, 'admitted_hospital'>; label: string }[] = [
  { code: 'moved_home', label: EXIT_REASON_LABEL.moved_home },
  { code: 'moved_relative', label: EXIT_REASON_LABEL.moved_relative },
  { code: 'transferred_shelter', label: EXIT_REASON_LABEL.transferred_shelter },
  { code: 'self_discharge', label: EXIT_REASON_LABEL.self_discharge },
  { code: 'lost_contact', label: EXIT_REASON_LABEL.lost_contact },
  { code: 'deceased', label: EXIT_REASON_LABEL.deceased },
  { code: 'other', label: EXIT_REASON_LABEL.other },
]

export interface ShelterZone {
  id: string
  shelterId: string
  name: string
  description?: string | null
  sortOrder: number
}

export interface ShelterAdmission {
  id: string
  shelterId: string
  zoneId?: string | null
  memberId?: string
  helpRequestId?: string
  admittedBy?: string
  status: AdmissionStatus
  needsFollowUp: boolean
  intakePoint?: string | null
  broughtByTeamId?: string | null
  broughtByText?: string | null
  exitReason?: AdmissionExitReason | null
  exitDestination?: string | null
  notes?: string
  admittedAt: string
  dischargedAt?: string
}

/** Person summary attached to a shelter admission for display (joined from householdMembers) */
export interface AdmissionPerson {
  id?: string | null
  name: string
  prefix?: string | null
  firstName?: string | null
  lastName?: string | null
  nationalIdMasked?: string | null   // มาจาก server เสมอ — masked แล้ว
  birthDate?: string | null
  age?: number | null
  sex?: string | null
  nationality?: string | null
  phone?: string | null
  hno?: string | null
  villno?: string | null
  tambon?: string | null
  amphoe?: string | null
  conditions?: string | null
  foodAllergy?: string | null
  drugAllergy?: string | null
  equipment?: string | null          // อุปกรณ์/เครื่องมือ (freeform)
  lifeSupport?: string[] | null      // อุปกรณ์พยุงชีพ (oxygen|feeding_tube|dialysis_*|ventilator|anti_seizure)
  vulnerableType?: string | null     // ประเภทเปราะบาง: bedridden|elderly|disabled|pregnant|other
  vulnerableLabel?: string | null    // ป้ายไทยที่บันทึกไว้ (ถ้ามี)
  isVulnerable?: boolean
  activeShelterName?: string | null
}

// ป้ายอุปกรณ์พยุงชีพ — ใช้ร่วมหลายหน้า
export const LIFE_SUPPORT_LABEL: Record<string, string> = {
  oxygen: 'ออกซิเจน',
  dialysis_capd: 'ฟอกไต (CAPD)',
  dialysis_hd: 'ฟอกไตเลือด (HD)',
  ventilator: 'เครื่องช่วยหายใจ',
  anti_seizure: 'ยากันชัก',
  feeding_tube: 'สายให้อาหาร',
}

// ───────── การส่งต่อผู้ป่วย ศูนย์พักพิง → สถานพยาบาล ─────────
export type ReferralPriority = 'low' | 'normal' | 'high' | 'critical'
export type ReferralStatus =
  | 'pending'    // ส่งต่อแล้ว รอปลายทางรับทราบ
  | 'accepted'   // รพ.รับทราบ/ตอบรับ
  | 'en_route'   // กำลังนำส่ง
  | 'arrived'    // ถึง รพ.แล้ว
  | 'admitted'   // รับเข้ารักษา
  | 'rejected'   // ปลายทางปฏิเสธ
  | 'cancelled'  // ยกเลิก

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: 'รอปลายทางรับทราบ',
  accepted: 'ตอบรับแล้ว',
  en_route: 'กำลังนำส่ง',
  arrived: 'ถึงโรงพยาบาลแล้ว',
  admitted: 'รับเข้ารักษา',
  rejected: 'ปฏิเสธ',
  cancelled: 'ยกเลิก',
}

export const REFERRAL_PRIORITY_LABEL: Record<ReferralPriority, string> = {
  low: 'ไม่เร่งด่วน',
  normal: 'ปกติ',
  high: 'เร่งด่วน',
  critical: 'วิกฤต',
}

export interface HospitalReferral {
  id: string
  incidentId?: string | null
  admissionId?: string | null
  memberId?: string | null
  fromShelterId: string
  fromShelterName?: string | null
  toFacilityId?: string | null
  toFacilityName?: string | null
  toFacilityText?: string | null
  personName?: string | null
  reason?: string | null
  priority: ReferralPriority
  status: ReferralStatus
  notes?: string | null
  referredBy?: string | null
  referredAt: string
  updatedAt?: string | null
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

export type CrFloodLayerKey =
  | 'cr_cei'
  | 'cr_detail'
  | 'cr_flow1500'
  | 'cr_flow2000'
  | 'ms_coarse'
  | 'ms_detail'

export type GistdaLayers = Record<GistdaLayerKey, boolean>
export type FloodMarkLayers = Record<FloodMarkLevel, boolean>
export type CmuFloodLayers = Record<CmuFloodLayerKey, boolean>
export type CrFloodLayers = Record<CrFloodLayerKey, boolean>

export interface LayerState {
  gistda: GistdaLayers
  floodMarks: FloodMarkLayers
  cmuFlood: CmuFloodLayers
  crFlood: CrFloodLayers
  vulnerable: boolean
  infra: boolean
  routes: boolean
  userFloodMarks: boolean
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

// Flood mark ที่ผู้ใช้ปักเอง (officer/vhv+) — เผื่อจังหวัดที่ CMU ไม่มีข้อมูล
export interface UserFloodMark {
  id: string
  code: string | null
  lat: number
  lng: number
  waterLevelCm: number
  level: FloodMarkLevel
  placeDetail: string | null
  placeAround: string | null
  province: string | null
  amphoe: string | null
  tambon: string | null
  contactPhone: string | null
  observedAt: string | null
  imageUrl: string | null
  createdBy: string | null
  createdAt: string | null
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

export interface CrFloodLayerConfig {
  key: CrFloodLayerKey
  label: string
  meta: string
  /** filename under /data/cr_geo/ */
  file: string
  area: 'cr' | 'ms'
}

export const CR_FLOOD_LAYERS: CrFloodLayerConfig[] = [
  {
    key: 'cr_cei',
    label: 'เชียงราย · CEI Scenario',
    meta: 'ภาพรวมกว้าง · ความลึก 0–10+ ม.',
    file: 'cr_cei.geojson',
    area: 'cr',
  },
  {
    key: 'cr_detail',
    label: 'เชียงราย · รายละเอียด',
    meta: 'ย่านเมือง · ความลึก 0–10+ ม.',
    file: 'cr_detail.geojson',
    area: 'cr',
  },
  {
    key: 'cr_flow1500',
    label: 'เชียงราย · Flow 1500 m³/s',
    meta: 'ปริมาณน้ำ 1,500 ลบ.ม./วิ',
    file: 'cr_flow1500.geojson',
    area: 'cr',
  },
  {
    key: 'cr_flow2000',
    label: 'เชียงราย · Flow 2000 m³/s',
    meta: 'ปริมาณน้ำ 2,000 ลบ.ม./วิ',
    file: 'cr_flow2000.geojson',
    area: 'cr',
  },
  {
    key: 'ms_coarse',
    label: 'แม่สาย · ภาพกว้าง',
    meta: 'ความละเอียดต่ำ · ความลึก 0–10+ ม.',
    file: 'ms_coarse.geojson',
    area: 'ms',
  },
  {
    key: 'ms_detail',
    label: 'แม่สาย · รายละเอียด',
    meta: 'ความละเอียดสูง · ความลึก 0–5+ ม.',
    file: 'ms_detail.geojson',
    area: 'ms',
  },
]

export type BasemapType = 'sat' | 'street' | 'osm' | 'topo' | 'hybrid' | 'google' | 'google_sat'

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
