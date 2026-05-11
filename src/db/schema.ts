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
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  caregiverPhone: text('caregiver_phone'),
  consent: boolean('consent').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Infrastructure
export const infrastructures = pgTable('infrastructures', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(), // hospital | clinic | shelter | assembly
  capacity: integer('capacity'),
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  icon: text('icon'),
  contact: text('contact'),
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
