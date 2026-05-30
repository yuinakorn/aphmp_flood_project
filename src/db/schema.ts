import {
  pgTable,
  bigserial,
  text,
  smallint,
  date,
  timestamp,
  numeric,
  uuid,
  inet,
  integer,
  boolean,
  jsonb,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Water stations — master threshold table
export const waterStations = pgTable('water_station', {
  stationCode: varchar('station_code', { length: 20 }).primaryKey(),
  stationNameTh: text('station_name_th').notNull(),
  stationNameEn: text('station_name_en'),
  riverBasin: text('river_basin'),
  province: text('province'),
  district: text('district'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  warningLevel: numeric('warning_level', { precision: 6, scale: 2 }),
  prepareLevel: numeric('prepare_level', { precision: 6, scale: 2 }),
  criticalLevel: numeric('critical_level', { precision: 6, scale: 2 }),
  dangerLevel: numeric('danger_level', { precision: 6, scale: 2 }),
  rapidRiseThreshold: numeric('rapid_rise_threshold', { precision: 6, scale: 2 }),
  warningDischarge: numeric('warning_discharge', { precision: 12, scale: 2 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Station pairs — upstream → downstream relation per river basin
export const waterStationPairs = pgTable('water_station_pair', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  upstreamStation: varchar('upstream_station', { length: 20 })
    .notNull()
    .references(() => waterStations.stationCode, { onDelete: 'cascade' }),
  downstreamStation: varchar('downstream_station', { length: 20 })
    .notNull()
    .references(() => waterStations.stationCode, { onDelete: 'cascade' }),
  riverBasin: text('river_basin'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Flood detections — Sentinel-1 SAR
export const floodPoints = pgTable('flood_points', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  intensity: smallint('intensity').notNull().default(1),
  source: text('source').notNull().default('sentinel-1'),
  observedAt: date('observed_at').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow(),
})

// Flood polygons — Sentinel-2 / GISTDA KMZ
export const floodPolygons = pgTable('flood_polygons', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  geojson: text('geojson').notNull(),  // GeoJSON string (MultiPolygon)
  tambon: text('tambon'),
  amphoe: text('amphoe'),
  province: text('province'),
  source: text('source').notNull().default('sentinel-2'),
  observedAt: date('observed_at').notNull(),
  areaSqkm: numeric('area_sqkm', { precision: 10, scale: 3 }),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow(),
})

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('viewer'), // admin | officer | viewer
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// API keys สำหรับหน่วยบริการ (รพ.สต./อปท.) ที่ส่งข้อมูลเข้าระบบ
export const unitApiKeys = pgTable('unit_api_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  keyHash: text('key_hash').notNull().unique(), // SHA-256 ของ raw key
  unitCode: text('unit_code').notNull(),        // pcucode หรือรหัสหน่วยบริการ
  unitName: text('unit_name').notNull(),
  province: text('province'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
})

// ───────── ที่อยู่มาตรฐาน (กรมการปกครอง DOPA) — จังหวัด → อำเภอ → ตำบล ─────────
export const geoProvinces = pgTable('geo_provinces', {
  id: integer('id').primaryKey(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
})

export const geoDistricts = pgTable('geo_districts', {
  id: integer('id').primaryKey(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  provinceId: integer('province_id')
    .notNull()
    .references(() => geoProvinces.id),
})

export const geoSubdistricts = pgTable('geo_subdistricts', {
  id: integer('id').primaryKey(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  zipCode: integer('zip_code'),
  districtId: integer('district_id')
    .notNull()
    .references(() => geoDistricts.id),
})

// ───────── Family Folder — ครัวเรือน + สมาชิก (แทนการดึงสดจาก JHCIS) ─────────
export const households = pgTable('households', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  hno: text('hno'),                  // บ้านเลขที่
  villageName: text('village_name'), // ชื่อหมู่บ้าน
  villno: text('villno'),            // หมู่ที่
  villcode: text('villcode'),        // รหัสหมู่บ้าน (ใช้ group ใน summary)
  tambon: text('tambon'),
  amphoe: text('amphoe'),
  province: text('province'),
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// householdMembers = "คน" หนึ่งคนในระบบ (ทะเบียนประชากร + ส่วนขยายสุขภาพ/ดูแลในตารางเดียว)
// คนที่อยู่ในทะเบียนกลุ่มเปราะบาง/ดูแล = แถวที่ `type` IS NOT NULL
// householdId เป็น nullable — รองรับคนที่กรอกเดี่ยว (manual/ingest) โดยยังไม่ผูก family folder
export const householdMembers = pgTable('household_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'cascade' }),
  prefix: text('prefix'),                  // คำนำหน้า (นาย/นาง/ด.ช./ฯลฯ)
  firstName: text('first_name').notNull(), // ชื่อ
  lastName: text('last_name').notNull(),   // นามสกุล
  nationalId: text('national_id'),         // เลขบัตรประชาชน 13 หลัก (PDPA — ทุก access ถูก log)
  birthDate: date('birth_date'),           // วันเกิด (วัน/เดือน/ปี)
  nationality: text('nationality'),        // ไทย / พม่า / ไร้สถานะ / ฯลฯ
  age: smallint('age'),
  sex: text('sex'),                  // 'ชาย' | 'หญิง' | '-'
  phone: text('phone'),              // เบอร์ติดต่อรายบุคคล
  // address ส่วนเสริม (tambon/amphoe/province อยู่ด้านล่างแล้ว)
  hno: text('hno'),                  // บ้านเลขที่
  villno: text('villno'),            // หมู่ที่
  // ประวัติแพ้
  foodAllergy: text('food_allergy'), // ประวัติแพ้อาหาร
  drugAllergy: text('drug_allergy'), // ประวัติแพ้ยา
  familyPosition: text('family_position'), // หัวหน้าครัวเรือน / คู่สมรส / บุตร ...
  isHead: boolean('is_head').notNull().default(false),
  isDisabled: boolean('is_disabled').notNull().default(false),
  isChronic: boolean('is_chronic').notNull().default(false),
  // ความสัมพันธ์ (ชื่อ) — สอดคล้องกับโครงสร้าง JHCIS เดิม
  father: text('father'),
  mother: text('mother'),
  mate: text('mate'),
  // ───── ส่วนขยายสุขภาพ/กลุ่มเปราะบาง (เดิมอยู่ตาราง vulnerable_persons) ─────
  type: text('type'),                // bedridden | elderly | disabled | pregnant | other — null = ไม่อยู่ในทะเบียนดูแล
  label: text('label'),
  cond: text('cond'),
  equipment: text('equipment'),
  village: text('village'),
  tambon: text('tambon'),
  amphoe: text('amphoe'),
  province: text('province'),
  lat: numeric('lat', { precision: 10, scale: 6 }),  // พิกัดเฉพาะคน — ถ้า null ใช้พิกัดของ household
  lng: numeric('lng', { precision: 10, scale: 6 }),
  caregiverPhone: text('caregiver_phone'),
  careUnit: text('care_unit'),       // รพ.สต./หน่วยบริการประจำ
  assignedVhvId: uuid('assigned_vhv_id'),
  medicalPriority: text('medical_priority'), // A | B | C
  followUpStatus: text('follow_up_status'),  // pending | contacted | needs_help | moved | referred | closed
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
  lastKnownStatus: text('last_known_status'),
  consent: boolean('consent').default(false),
  sourceSystem: text('source_system'),     // 'jhcis' | 'hosxp' | 'manual' | 'import'
  sourceUnit: text('source_unit'),
  sourceId: text('source_id'),
  sourceSyncedAt: timestamp('source_synced_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  // ป้องกัน duplicate จากแหล่งเดิม — NULL ถือว่าไม่ conflict (Postgres standard)
  uniqueIndex('hm_source_unique_idx').on(t.sourceSystem, t.sourceUnit, t.sourceId),
])

// Flood marks ที่ผู้ใช้ปักเอง — เผื่อจังหวัดที่ CMU Water Center ไม่มีข้อมูล
export const userFloodMarks = pgTable('user_flood_marks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  // รหัสจุดแบบอ่านง่าย เช่น CR_00001 — running number แยกตามจังหวัด (null ถ้าจังหวัดอยู่นอกขอบเขต)
  code: text('code'),
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  waterLevelCm: numeric('water_level_cm', { precision: 6, scale: 1 }).notNull(),
  level: smallint('level').notNull(), // 1-5 derive จาก waterLevelCm
  placeDetail: text('place_detail'),
  placeAround: text('place_around'),
  province: text('province'),
  amphoe: text('amphoe'),
  tambon: text('tambon'),
  contactPhone: text('contact_phone'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  imageUrl: text('image_url'), // เผื่ออนาคต — ตอนนี้ยังไม่รับรูป
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // ไม่ผูก FK — ผู้ปักอาจเป็น SSO identity ที่ไม่ได้ mirror ลงตาราง users
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex('user_flood_marks_code_key').on(t.code),
])

// ตัวนับ running number ของรหัสจุด flood mark แยกตาม prefix จังหวัด (atomic upsert ตอนปักหมุด)
export const userFloodMarkCodeSeq = pgTable('user_flood_mark_code_seq', {
  prefix: text('prefix').primaryKey(),
  lastNo: integer('last_no').notNull().default(0),
})

// Infrastructure
export const infrastructures = pgTable('infrastructures', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(), // hospital | clinic | shelter | assembly | temporary_health_post
  capacity: integer('capacity'),
  occupancy: integer('occupancy').notNull().default(0),
  readinessStatus: text('readiness_status').notNull().default('open'), // open | near_capacity | full | closed | unsafe
  healthCapacity: integer('health_capacity'),
  bedriddenCapacity: integer('bedridden_capacity'),
  wheelchairSupport: boolean('wheelchair_support').notNull().default(false),
  oxygenSupport: boolean('oxygen_support').notNull().default(false),
  electricitySupport: boolean('electricity_support').notNull().default(false),
  waterSanitationStatus: text('water_sanitation_status'),
  healthResources: jsonb('health_resources').$type<Record<string, unknown>>(),
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  icon: text('icon'),
  contact: text('contact'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// เหตุการณ์ภัยพิบัติ (Incident) — "โหมดวิกฤต" ที่เปิดซ้อนทับทะเบียนสุขภาพ
export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),          // เช่น "น้ำท่วม ต.สันทราย ต.ค. 2568"
  type: text('type').notNull().default('flood'),     // flood | storm | other
  status: text('status').notNull().default('active'), // active | monitoring | closed
  province: text('province'),
  amphoe: text('amphoe'),
  tambon: text('tambon'),
  description: text('description'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  // ไม่ผูก FK — ผู้เปิดเหตุการณ์อาจเป็น SSO identity ที่ไม่ได้ mirror ลงตาราง users
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ทีมกู้ภัย / หน่วยเคลื่อนที่เร็ว — ขึ้นทะเบียน + แบ่งโซนรับผิดชอบ (กันเข้าช่วยซ้ำซ้อน/บ้านถูกทิ้งร้าง)
export const rescueTeams = pgTable('rescue_teams', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  incidentId: uuid('incident_id').references(() => incidents.id),
  name: text('name').notNull(),
  teamType: text('team_type').notNull().default('rescue_boat'), // rescue_boat | gmc_truck | ems_medical | mcat_psych | volunteer_kitchen | other
  contact: text('contact'),       // เบอร์ศูนย์วิทยุ/ผู้ประสานงาน
  zone: text('zone'),             // โซนรับผิดชอบ เช่น "โซนที่ 2 (บ.ท่าลี / บ.พญาภู)"
  status: text('status').notNull().default('active'), // active | standby | offline
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 }),
  registeredBy: uuid('registered_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// อสม. / field health visits
export const healthVisits = pgTable('health_visits', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  incidentId: uuid('incident_id').references(() => incidents.id),
  memberId: uuid('member_id').references(() => householdMembers.id),
  visitedBy: uuid('visited_by'),
  visitStatus: text('visit_status').notNull().default('pending'), // pending | completed | unreachable | needs_follow_up
  personStatus: text('person_status'), // safe | needs_help | evacuated | referred | unknown
  needsHelp: boolean('needs_help').notNull().default(false),
  helpType: text('help_type'), // medicine | transport | evacuation | food_water | other
  // ───── ประเมินคลินิก/จิตใจภาคสนาม (VHV screen) ─────
  vitalStatus: text('vital_status'),   // normal | monitoring | unstable (ชีพจร/อาการเบื้องต้น)
  mentalStatus: text('mental_status'), // good | anxiety (สภาพอารมณ์/จิตใจ)
  needsMcat: boolean('needs_mcat').notNull().default(false), // ต้องการทีมสุขภาพจิต MCAT สนับสนุน
  medSufficient: boolean('med_sufficient'), // ยา/เวชภัณฑ์พอใช้เกิน 7 วัน
  oxygenReady: boolean('oxygen_ready'),     // เครื่องผลิต/ถังออกซิเจนพร้อม
  notes: text('notes'),
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 }),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Help requests from VHV/field staff/EOC
export const helpRequests = pgTable('help_requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  incidentId: uuid('incident_id').references(() => incidents.id),
  memberId: uuid('member_id').references(() => householdMembers.id),
  requestedBy: uuid('requested_by'),
  sourceRole: text('source_role').notNull().default('vhv'), // vhv | eoc | ems | officer | public
  requestType: text('request_type').notNull(), // medical | evacuation | supplies | rescue | shelter | other
  priority: text('priority').notNull().default('normal'), // low | normal | high | critical
  status: text('status').notNull().default('new'), // new | triaged | assigned | en_route | resolved | cancelled
  description: text('description'),
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 }),
  preferredShelterId: uuid('preferred_shelter_id').references(() => infrastructures.id),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Assignment and status timeline for EMS/rescue/field teams
export const caseAssignments = pgTable('case_assignments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  helpRequestId: uuid('help_request_id').notNull().references(() => helpRequests.id),
  assignedTo: uuid('assigned_to'),
  rescueTeamId: uuid('rescue_team_id').references(() => rescueTeams.id), // ทีมจากทะเบียน rescue_teams
  assignedTeam: text('assigned_team'), // ข้อความอิสระ (กรณีทีมนอกทะเบียน) — EMS, มูลนิธิ, ทีมอำเภอ ฯลฯ
  assignedBy: uuid('assigned_by'),
  status: text('status').notNull().default('assigned'), // assigned | accepted | en_route | arrived | transferred | closed
  etaMinutes: integer('eta_minutes'),
  notes: text('notes'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Real-time-ish shelter capacity snapshots
export const shelterStatusSnapshots = pgTable('shelter_status_snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  shelterId: uuid('shelter_id').notNull().references(() => infrastructures.id),
  occupancy: integer('occupancy').notNull(),
  capacity: integer('capacity'),
  readinessStatus: text('readiness_status').notNull(),
  healthResources: jsonb('health_resources').$type<Record<string, unknown>>(),
  reportedBy: uuid('reported_by'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
})

// โซนรับเข้าของศูนย์พักพิง — แต่ละศูนย์กำหนดโซนเอง (เช่น "ติดเตียง-ส่งต่อ รพ.", "ผู้พักทั่วไป", "โซนชาติพันธุ์")
// ไม่ใช้ enum ตายตัว เพื่อให้แต่ละจังหวัด/ศูนย์ออกแบบได้เอง
export const shelterZones = pgTable('shelter_zones', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  shelterId: uuid('shelter_id').notNull().references(() => infrastructures.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: smallint('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Admission of vulnerable persons into shelters
export const shelterAdmissions = pgTable('shelter_admissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  shelterId: uuid('shelter_id').notNull().references(() => infrastructures.id),
  zoneId: uuid('zone_id').references(() => shelterZones.id),
  memberId: uuid('member_id').references(() => householdMembers.id),
  incidentId: uuid('incident_id').references(() => incidents.id),
  helpRequestId: uuid('help_request_id').references(() => helpRequests.id),
  admittedBy: uuid('admitted_by'),
  status: text('status').notNull().default('admitted'), // admitted | transferred | discharged | cancelled
  needsFollowUp: boolean('needs_follow_up').notNull().default(false),
  intakePoint: text('intake_point'),               // จุดรับเข้า (ข้อความ — fallback ถ้าไม่ผูก zone)
  broughtByTeamId: uuid('brought_by_team_id').references(() => rescueTeams.id),
  broughtByText: text('brought_by_text'),          // ทีมนอกทะเบียน — ข้อความอิสระ
  exitReason: text('exit_reason'),                 // moved_home | admitted_hospital | transferred_shelter | other
  exitDestination: text('exit_destination'),
  notes: text('notes'),
  admittedAt: timestamp('admitted_at', { withTimezone: true }).defaultNow(),
  dischargedAt: timestamp('discharged_at', { withTimezone: true }),
})

// Audit log (PDPA)
export const accessLog = pgTable('access_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  targetId: uuid('target_id'),
  ip: inet('ip'),
  at: timestamp('at', { withTimezone: true }).defaultNow(),
})
