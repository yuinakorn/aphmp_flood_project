import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { shelterStaff } from '@/db/schema'
import type { UserRole } from '@/types'

// บทบาทที่เห็น roster ของ "ทุกศูนย์" ในเหตุการณ์ (ระดับสั่งการ/ผู้บริหาร)
const FULL_ROSTER_ROLES = new Set<UserRole>(['admin', 'eoc', 'ddpm', 'officer'])

/** role นี้เห็น roster ได้ทุกศูนย์หรือไม่ — ถ้า false ต้องถูกจำกัดด้วย shelter_staff */
export function canSeeAllShelters(role?: string | null): boolean {
  return !!role && FULL_ROSTER_ROLES.has(role as UserRole)
}

/** ดึงรายการ shelterId ที่ผู้ใช้คนนี้ถูก assign ให้ดูแล (ผ่านตาราง shelter_staff) */
export async function getManagedShelterIds(userId: string): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ shelterId: shelterStaff.shelterId })
    .from(shelterStaff)
    .where(eq(shelterStaff.userId, userId))
  return rows.map((r) => r.shelterId)
}

/**
 * คืนขอบเขตศูนย์ที่ผู้ใช้เข้าถึงได้:
 * - all = true → เห็นทุกศูนย์ (full-access role)
 * - all = false → เห็นเฉพาะ shelterIds (อาจว่าง = ไม่มีสิทธิ์เห็นศูนย์ใดเลย)
 */
export async function getShelterAccessScope(
  role: string | null | undefined,
  userId: string | null,
): Promise<{ all: boolean; shelterIds: string[] }> {
  if (canSeeAllShelters(role)) return { all: true, shelterIds: [] }
  if (!userId) return { all: false, shelterIds: [] }
  const shelterIds = await getManagedShelterIds(userId)
  return { all: false, shelterIds }
}

/** ผู้ใช้คนนี้เข้าถึง/จัดการศูนย์ที่ระบุได้หรือไม่ */
export async function canAccessShelter(
  role: string | null | undefined,
  userId: string | null,
  shelterId: string,
): Promise<boolean> {
  if (canSeeAllShelters(role)) return true
  if (!userId) return false
  const ids = await getManagedShelterIds(userId)
  return ids.includes(shelterId)
}
