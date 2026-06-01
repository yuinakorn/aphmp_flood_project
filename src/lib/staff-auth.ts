/**
 * staff-auth.ts — Authorization layer (แยกจาก authentication)
 *
 * ThaiD ยืนยันว่า "คุณคือ CID นี้" → ฟังก์ชันที่นี่ตอบว่า "CID นี้มีสิทธิ์อะไร จังหวัดไหน"
 * ดู docs/new/AUTH-SPEC.md
 */
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { users } from '@/db/schema'
import { hashCid } from '@/lib/cid'
import type { UserRole } from '@/types'

export type StaffStatus = 'pending' | 'active' | 'suspended'

export type StaffState = 'active' | 'pending' | 'suspended' | 'not_found'

export interface StaffRecord {
  id: string
  name: string
  role: UserRole
  province: string | null
  unitCode: string | null
  unitName: string | null
  status: 'pending' | 'active' | 'suspended'
}

export interface StaffResolution {
  state: StaffState
  staff: StaffRecord | null
}

/** ค้นเจ้าหน้าที่จาก CID (hash) แล้วบอกสถานะตาม state machine */
export async function resolveStaffByCid(rawCid: string): Promise<StaffResolution> {
  const db = getDb()
  const [row] = await db.select().from(users).where(eq(users.cidHash, hashCid(rawCid))).limit(1)
  if (!row) return { state: 'not_found', staff: null }

  const staff: StaffRecord = {
    id: row.id,
    name: row.name,
    role: row.role as UserRole,
    province: row.province,
    unitCode: row.unitCode,
    unitName: row.unitName,
    status: row.status as StaffRecord['status'],
  }
  return { state: staff.status, staff }
}

/** อัปเดตเวลา login ล่าสุด (fire-and-forget) */
export function touchLastLogin(userId: string): void {
  const db = getDb()
  void db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId)).catch(() => {})
}

export interface CreatePendingStaffInput {
  cid: string
  name: string
  province: string
  unitName?: string | null
  unitCode?: string | null
  role?: UserRole
}

/**
 * สร้างคำขอลงทะเบียน (self-register) — status=pending รอ admin อนุมัติ
 * คืน 'exists' ถ้า CID นี้อยู่ในระบบแล้ว (กันลงซ้ำ)
 */
export async function createPendingStaff(
  input: CreatePendingStaffInput,
): Promise<{ ok: true; id: string } | { ok: false; reason: 'exists' }> {
  const db = getDb()
  const cidHash = hashCid(input.cid)

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.cidHash, cidHash)).limit(1)
  if (existing) return { ok: false, reason: 'exists' }

  const [created] = await db
    .insert(users)
    .values({
      cidHash,
      name: input.name,
      role: input.role ?? 'officer',
      province: input.province,
      unitName: input.unitName ?? null,
      unitCode: input.unitCode ?? null,
      status: 'pending',
      registeredVia: 'thaid',
    })
    .returning({ id: users.id })

  return { ok: true, id: created.id }
}

/* ───────── ฝั่ง admin: จัดการทะเบียนเจ้าหน้าที่ ───────── */

export interface StaffListRow {
  id: string
  name: string
  role: UserRole
  province: string | null
  unitName: string | null
  status: StaffStatus
  registeredVia: string
  createdAt: string | null
  lastLoginAt: string | null
  approvedAt: string | null
}

/** รายชื่อเจ้าหน้าที่ — national เห็นทุกจังหวัด, อื่นๆ เห็นเฉพาะจังหวัดตัวเอง */
export async function listStaff(opts: { national: boolean; province: string | null }): Promise<StaffListRow[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(users)
    .where(opts.national ? undefined : eq(users.province, opts.province ?? '__none__'))
    .orderBy(desc(users.createdAt))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role as UserRole,
    province: r.province,
    unitName: r.unitName,
    status: r.status as StaffStatus,
    registeredVia: r.registeredVia,
    createdAt: r.createdAt?.toISOString() ?? null,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
  }))
}

/** ดึง staff record ดิบ (ตรวจ province ก่อนแก้) */
export async function getStaffById(id: string) {
  const db = getDb()
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

/** เปลี่ยนสถานะ — อนุมัติ (pending→active) / ระงับ / คืนสิทธิ์ */
export async function setStaffStatus(id: string, status: StaffStatus, approverId: string | null): Promise<void> {
  const db = getDb()
  const patch: Partial<typeof users.$inferInsert> =
    status === 'active'
      ? { status, approvedBy: approverId, approvedAt: new Date() }
      : { status }
  await db.update(users).set(patch).where(eq(users.id, id))
}

/** เปลี่ยน role ของเจ้าหน้าที่ */
export async function setStaffRole(id: string, role: UserRole): Promise<void> {
  const db = getDb()
  await db.update(users).set({ role }).where(eq(users.id, id))
}

export interface CreateWhitelistStaffInput {
  cid: string
  name: string
  role: UserRole
  province: string
  unitName?: string | null
  unitCode?: string | null
  approverId?: string | null
}

/** ออก whitelist เจ้าหน้าที่ล่วงหน้า — status=active เข้าได้ทันทีเมื่อ login ThaiD */
export async function createWhitelistStaff(
  input: CreateWhitelistStaffInput,
): Promise<{ ok: true; id: string } | { ok: false; reason: 'exists' }> {
  const db = getDb()
  const cidHash = hashCid(input.cid)

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.cidHash, cidHash)).limit(1)
  if (existing) return { ok: false, reason: 'exists' }

  const [created] = await db
    .insert(users)
    .values({
      cidHash,
      name: input.name,
      role: input.role,
      province: input.province,
      unitName: input.unitName ?? null,
      unitCode: input.unitCode ?? null,
      status: 'active',
      registeredVia: 'whitelist',
      approvedBy: input.approverId ?? null,
      approvedAt: new Date(),
    })
    .returning({ id: users.id })

  return { ok: true, id: created.id }
}
