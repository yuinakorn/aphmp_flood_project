'use server'

import { isValidThaiCid } from '@/lib/cid'
import { createPendingStaff } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { isRequestableRole } from '@/lib/roles'

export interface RegisterResult {
  ok: boolean
  error?: 'invalid_cid' | 'invalid_province' | 'missing_name' | 'invalid_role' | 'exists'
}

export async function registerStaffAction(input: {
  cid: string
  name: string
  province: string
  role: string
  unitName?: string
}): Promise<RegisterResult> {
  if (!isValidThaiCid(input.cid)) return { ok: false, error: 'invalid_cid' }
  if (!input.name?.trim()) return { ok: false, error: 'missing_name' }
  if (!(ALLOWED_PROVINCES as readonly string[]).includes(input.province)) {
    return { ok: false, error: 'invalid_province' }
  }
  if (!isRequestableRole(input.role)) {
    return { ok: false, error: 'invalid_role' }
  }

  const res = await createPendingStaff({
    cid: input.cid,
    name: input.name.trim(),
    province: input.province,
    role: input.role,
    unitName: input.unitName?.trim() || null,
  })

  if (!res.ok) return { ok: false, error: res.reason }
  return { ok: true }
}
