'use server'

import { isValidThaiCid } from '@/lib/cid'
import { resolveStaffByCid, type StaffState } from '@/lib/staff-auth'

export interface CidCheckResult {
  state: StaffState | 'invalid'
  name: string | null
}

/**
 * จำลองขั้นตอน ThaiD ยืนยันตัวตน → ตรวจสิทธิ์ในทะเบียนเจ้าหน้าที่
 * ฝั่ง client ใช้ผลนี้ตัดสินว่าจะ signIn / โชว์ข้อความ / พาไปลงทะเบียน
 */
export async function resolveCidAction(rawCid: string): Promise<CidCheckResult> {
  if (!isValidThaiCid(rawCid)) return { state: 'invalid', name: null }
  const { state, staff } = await resolveStaffByCid(rawCid)
  return { state, name: staff?.name ?? null }
}
