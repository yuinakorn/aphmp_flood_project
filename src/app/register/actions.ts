'use server'

import { isValidThaiCid } from '@/lib/cid'
import { createPendingStaff } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'

export interface RegisterResult {
  ok: boolean
  error?: 'invalid_cid' | 'invalid_province' | 'missing_name' | 'exists'
}

export async function registerStaffAction(input: {
  cid: string
  name: string
  province: string
  unitName?: string
}): Promise<RegisterResult> {
  if (!isValidThaiCid(input.cid)) return { ok: false, error: 'invalid_cid' }
  if (!input.name?.trim()) return { ok: false, error: 'missing_name' }
  if (!(ALLOWED_PROVINCES as readonly string[]).includes(input.province)) {
    return { ok: false, error: 'invalid_province' }
  }

  const res = await createPendingStaff({
    cid: input.cid,
    name: input.name.trim(),
    province: input.province,
    unitName: input.unitName?.trim() || null,
  })

  if (!res.ok) return { ok: false, error: res.reason }
  return { ok: true }
}
