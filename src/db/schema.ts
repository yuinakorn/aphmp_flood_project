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

// Vulnerable persons
export const vulnerablePersons = pgTable('vulnerable_persons', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(), // bedridden | elderly | disabled | pregnant
  label: text('label').notNull(),
  age: smallint('age'),
  cond: text('cond'),
  equipment: text('equipment'),
  village: text('village'),
  tambon: text('tambon'),
  amphoe: text('amphoe'),
  province: text('province'),
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  caregiverPhone: text('caregiver_phone'),
  careUnit: text('care_unit'), // รพ.สต./หน่วยบริการประจำ
  assignedVhvId: uuid('assigned_vhv_id').references(() => users.id),
  medicalPriority: text('medical_priority').notNull().default('C'), // A | B | C
  followUpStatus: text('follow_up_status').notNull().default('pending'), // pending | contacted | needs_help | moved | referred | closed
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
  lastKnownStatus: text('last_known_status'),
  consent: boolean('consent').default(false),
  // แหล่งข้อมูล — null หมายถึงกรอกเอง (manual)
  sourceSystem: text('source_system'),     // 'jhcis' | 'hosxp' | 'manual' | 'import'
  sourceUnit: text('source_unit'),         // pcucode ของต้นทาง
  sourceId: text('source_id'),            // PID หรือ ID ในระบบต้นทาง
  sourceSyncedAt: timestamp('source_synced_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  // ป้องกัน duplicate จากแหล่งเดิม — NULL ถือว่าไม่ conflict (Postgres standard)
  uniqueIndex('vp_source_unique_idx').on(t.sourceSystem, t.sourceUnit, t.sourceId),
])

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

// Flood marks ที่ผู้ใช้ปักเอง — เผื่อจังหวัดที่ CMU Water Center ไม่มีข้อมูล
export const userFloodMarks = pgTable('user_flood_marks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
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

// อสม. / field health visits
export const healthVisits = pgTable('health_visits', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  vulnerablePersonId: uuid('vulnerable_person_id').references(() => vulnerablePersons.id),
  visitedBy: uuid('visited_by').references(() => users.id),
  visitStatus: text('visit_status').notNull().default('pending'), // pending | completed | unreachable | needs_follow_up
  personStatus: text('person_status'), // safe | needs_help | evacuated | referred | unknown
  needsHelp: boolean('needs_help').notNull().default(false),
  helpType: text('help_type'), // medicine | transport | evacuation | food_water | other
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
  vulnerablePersonId: uuid('vulnerable_person_id').references(() => vulnerablePersons.id),
  requestedBy: uuid('requested_by').references(() => users.id),
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
  assignedTo: uuid('assigned_to').references(() => users.id),
  assignedTeam: text('assigned_team'), // EMS, rescue foundation, district team, etc.
  assignedBy: uuid('assigned_by').references(() => users.id),
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
  reportedBy: uuid('reported_by').references(() => users.id),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
})

// Admission of vulnerable persons into shelters
export const shelterAdmissions = pgTable('shelter_admissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  shelterId: uuid('shelter_id').notNull().references(() => infrastructures.id),
  vulnerablePersonId: uuid('vulnerable_person_id').references(() => vulnerablePersons.id),
  helpRequestId: uuid('help_request_id').references(() => helpRequests.id),
  admittedBy: uuid('admitted_by').references(() => users.id),
  status: text('status').notNull().default('admitted'), // admitted | transferred | discharged | cancelled
  needsFollowUp: boolean('needs_follow_up').notNull().default(false),
  notes: text('notes'),
  admittedAt: timestamp('admitted_at', { withTimezone: true }).defaultNow(),
  dischargedAt: timestamp('discharged_at', { withTimezone: true }),
})

// Audit log (PDPA)
export const accessLog = pgTable('access_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  targetId: uuid('target_id'),
  ip: inet('ip'),
  at: timestamp('at', { withTimezone: true }).defaultNow(),
})
