/**
 * unit-auth.ts
 * Authentication สำหรับหน่วยบริการภายนอก (รพ.สต., อปท.) ที่ส่งข้อมูลผ่าน API
 *
 * รูปแบบ: Bearer token ใน Authorization header
 * Key format: hex string 64 chars (32 bytes random) — ออกโดย admin ส่งให้หน่วยบริการ
 * เก็บใน DB เป็น SHA-256 hash เท่านั้น ไม่เก็บ raw key
 */

import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { unitApiKeys } from '@/db/schema'

export interface AuthedUnit {
  id: string
  unitCode: string
  unitName: string
  province: string | null
}

/**
 * ดึง raw key จาก Authorization header
 * รองรับ "Bearer <key>" และ "<key>" ตรงๆ
 */
export function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader) return null
  const trimmed = authHeader.trim()
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim() || null
  }
  return trimmed || null
}

/**
 * Hash raw key ด้วย SHA-256
 */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/**
 * ตรวจสอบ API key และคืน unit info ถ้าถูกต้อง
 * อัปเดต last_used_at โดยไม่รอผล (fire-and-forget)
 */
export async function authenticateUnit(rawKey: string): Promise<AuthedUnit | null> {
  const hash = hashKey(rawKey)
  const db = getDb()

  const [record] = await db
    .select()
    .from(unitApiKeys)
    .where(eq(unitApiKeys.keyHash, hash))
    .limit(1)

  if (!record || !record.isActive) return null

  // อัปเดต lastUsedAt แบบ fire-and-forget — ไม่ block response
  void db
    .update(unitApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(unitApiKeys.id, record.id))
    .catch(() => {})

  return {
    id: record.id,
    unitCode: record.unitCode,
    unitName: record.unitName,
    province: record.province,
  }
}
