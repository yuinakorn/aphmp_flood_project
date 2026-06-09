'use server'

import { auth } from '@/lib/auth'
import { submitAccessRequest } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { isRequestableRole } from '@/lib/roles'
import { isUuid } from '@/lib/field-api'

export interface RequestAccessResult {
  ok: boolean
  error?: 'unauthorized' | 'stale_session' | 'invalid_province' | 'invalid_role' | 'not_pending' | 'failed'
}

export async function requestAccessAction(input: {
  province: string
  role: string
  unitName?: string
}): Promise<RequestAccessResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'unauthorized' }
  // session.user.id ต้องเป็น DB uuid — ถ้าไม่ใช่ แปลว่า session เก่า (ก่อนผูกทะเบียน) ต้อง login ใหม่
  if (!isUuid(session.user.id)) return { ok: false, error: 'stale_session' }

  if (!(ALLOWED_PROVINCES as readonly string[]).includes(input.province)) {
    return { ok: false, error: 'invalid_province' }
  }
  if (!isRequestableRole(input.role)) {
    return { ok: false, error: 'invalid_role' }
  }

  const res = await submitAccessRequest({
    userId: session.user.id,
    province: input.province,
    role: input.role,
    unitName: input.unitName,
  })

  if (!res.ok) {
    if (res.reason === 'not_pending') return { ok: false, error: 'not_pending' }
    // not_found = ไม่มี record ตาม id นี้ (session ไม่ตรงทะเบียน) → ให้ login ใหม่
    return { ok: false, error: 'stale_session' }
  }
  return { ok: true }
}
