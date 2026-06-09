/**
 * staff-auth.ts — Authorization layer (แยกจาก authentication)
 *
 * ThaiD ยืนยันว่า "คุณคือ CID นี้" → ฟังก์ชันที่นี่ตอบว่า "CID นี้มีสิทธิ์อะไร จังหวัดไหน"
 * ดู docs/new/AUTH-SPEC.md
 */
import { desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { users, accessLog } from '@/db/schema'
import { hashCid, normalizeCid } from '@/lib/cid'
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
      nationalId: normalizeCid(input.cid),
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

/**
 * SSO (Provider ID / ThaiD จริง) — resolve ตัวตนตอน login
 * กุญแจ: cid_hash (ถ้า IdP ส่งมา) เป็นหลัก, ไม่งั้น sso_subject (provider_id)
 * - เจอ record → คืนสถานะจริงจาก DB + backfill กุญแจที่ขาด (เชื่อมช่องทาง) + sync ชื่อ
 * - ไม่เจอ → สร้าง record ใหม่ status=pending, role=viewer, ผูก sso_subject
 *   ผู้ใช้จะถูกพาไปหน้า /request-access เพื่อกรอก CID + เลือกจังหวัด/role
 *
 * หมายเหตุความปลอดภัย: role/จังหวัด ที่ใช้จริงต้องมาจาก DB เท่านั้น —
 * ห้าม trust role ที่ derive จาก SSO profile (เช่น is_director) ให้ผ่านโดยไม่อนุมัติ
 */
export async function resolveSsoIdentity(input: {
  providerId: string
  cidHash?: string | null
  name: string
}): Promise<StaffRecord> {
  const db = getDb()

  // หาด้วย cid_hash ก่อน (กุญแจตัวตนหลัก) แล้วค่อย sso_subject
  const findRow = async () => {
    if (input.cidHash) {
      const [r] = await db.select().from(users).where(eq(users.cidHash, input.cidHash)).limit(1)
      if (r) return r
    }
    const [r2] = await db.select().from(users).where(eq(users.ssoSubject, input.providerId)).limit(1)
    return r2 ?? null
  }

  let row = await findRow()

  // ไม่เจอ → สร้างใหม่ (upsert-safe: ถ้าชน unique จาก login ซ้อน ให้ re-select แทน throw)
  if (!row) {
    try {
      await db.insert(users).values({
        cidHash: input.cidHash ?? null,
        ssoSubject: input.providerId,
        name: input.name || 'ผู้ใช้ SSO',
        role: 'viewer',
        province: null,
        status: 'pending',
        registeredVia: 'sso',
      })
    } catch {
      // unique violation (race) — record ถูกสร้างโดย call อื่นแล้ว
    }
    row = await findRow()
  }

  if (!row) throw new Error('resolveSsoIdentity: could not resolve or create user')

  // backfill กุญแจที่ยังว่าง → เชื่อม login ช่องทางนี้เข้ากับ record เดิม
  const patch: Partial<typeof users.$inferInsert> = {}
  if (input.cidHash && !row.cidHash) patch.cidHash = input.cidHash
  if (!row.ssoSubject) patch.ssoSubject = input.providerId
  if (input.name && input.name !== row.name) patch.name = input.name
  if (Object.keys(patch).length > 0) {
    void db.update(users).set(patch).where(eq(users.id, row.id)).catch(() => {})
  }

  return {
    id: row.id,
    name: input.name || row.name,
    role: row.role as UserRole,
    province: row.province,
    unitCode: row.unitCode,
    unitName: row.unitName,
    status: row.status as StaffRecord['status'],
  }
}

/**
 * หา users.id จาก sso_subject (provider_id) — ใช้กู้ session ที่ id ไม่ตรง (stale/fallback)
 * match แบบ case-insensitive เพราะ provider_id อาจมาคนละ case (Auth.js บังคับ email เป็นตัวเล็ก)
 */
export async function findStaffIdBySsoSubject(providerId: string): Promise<string | null> {
  const db = getDb()
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.ssoSubject}) = lower(${providerId})`)
    .limit(1)
  return row?.id ?? null
}

export type AccessRequestOutcome =
  | { ok: true; linked: false }
  /** เชื่อมเข้ากับบัญชีเดิม (CID ตรงกับ record ที่มีอยู่) → ต้อง login ใหม่ */
  | { ok: true; linked: true; canonicalActive: boolean }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'cid_required' }

/**
 * ผู้ใช้ที่ login แล้วแต่ status=pending ส่งคำขอสิทธิ์ (จังหวัด + role + CID)
 *
 * dedupe ข้ามช่องทาง: ถ้า CID (cidHash) ตรงกับ record เดิมที่ไม่ใช่ตัวเอง →
 *   ย้าย sso_subject ไปผูกกับ record เดิม (canonical) แล้วลบ record SSO ที่เพิ่งสร้าง
 *   - canonical active → ผู้ใช้ได้สิทธิ์เดิมทันที (login ใหม่)
 *   - canonical pending → รวมคำขอเข้า canonical (ยังรออนุมัติ)
 * ถ้าไม่มี record เดิม → เซ็ต cid_hash/national_id ลง record ตัวเอง
 */
export async function submitAccessRequest(input: {
  userId: string
  province: string
  role: UserRole
  unitName?: string | null
  /** CID ดิบ (normalize แล้ว) — บังคับสำหรับผู้ใช้ SSO ที่ยังไม่มี cid_hash */
  cid?: string | null
}): Promise<AccessRequestOutcome> {
  const db = getDb()
  const [current] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
  if (!current) return { ok: false, reason: 'not_found' }
  if (current.status !== 'pending') return { ok: false, reason: 'not_pending' }

  // ผู้ใช้ที่ยังไม่มี cid_hash (SSO) ต้องกรอก CID เพื่อใช้เป็นกุญแจ dedupe
  if (!current.cidHash && !input.cid) return { ok: false, reason: 'cid_required' }

  const unitName = input.unitName?.trim() || null
  const cidHash = input.cid ? hashCid(input.cid) : null

  // กรณีมี CID → ตรวจหา record เดิมที่ผูก CID นี้ไว้แล้ว
  if (cidHash) {
    const [canonical] = await db.select().from(users).where(eq(users.cidHash, cidHash)).limit(1)

    if (canonical && canonical.id !== current.id) {
      // เจอบัญชีเดิม → เชื่อม sso_subject ของ current เข้ากับ canonical แล้วลบ current
      const canonicalActive = canonical.status === 'active'
      await db.transaction(async (tx) => {
        // ย้าย audit log ของ current ไปที่ canonical (กัน log ลอย)
        await tx.update(accessLog).set({ userId: canonical.id }).where(eq(accessLog.userId, current.id))
        // ลบ current ก่อน เพื่อปลดล็อก unique(sso_subject) ให้ canonical รับช่วงได้
        await tx.delete(users).where(eq(users.id, current.id))
        const patch: Partial<typeof users.$inferInsert> = {}
        if (current.ssoSubject && !canonical.ssoSubject) patch.ssoSubject = current.ssoSubject
        // ถ้า canonical ยัง pending → อัปเดตคำขอ (จังหวัด/role/หน่วยงาน) ให้ด้วย
        if (!canonicalActive) {
          patch.province = input.province
          patch.role = input.role
          patch.unitName = unitName
        }
        if (Object.keys(patch).length > 0) {
          await tx.update(users).set(patch).where(eq(users.id, canonical.id))
        }
      })
      return { ok: true, linked: true, canonicalActive }
    }

    // ไม่มีบัญชีเดิม (หรือ canonical คือตัวเอง) → ผูก CID ลง record ตัวเอง
    await db
      .update(users)
      .set({
        cidHash,
        nationalId: normalizeCid(input.cid!),
        province: input.province,
        role: input.role,
        unitName,
        status: 'pending',
      })
      .where(eq(users.id, current.id))
    return { ok: true, linked: false }
  }

  // ไม่มี CID (ผู้ใช้ที่มี cid_hash อยู่แล้ว) → อัปเดตคำขอตามปกติ
  await db
    .update(users)
    .set({ province: input.province, role: input.role, unitName, status: 'pending' })
    .where(eq(users.id, input.userId))
  return { ok: true, linked: false }
}

/* ───────── ฝั่ง admin: จัดการทะเบียนเจ้าหน้าที่ ───────── */

export interface StaffListRow {
  id: string
  name: string
  nationalId: string | null
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
    nationalId: r.nationalId,
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
      nationalId: normalizeCid(input.cid),
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
