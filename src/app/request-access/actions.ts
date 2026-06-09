'use server'

import { auth } from '@/lib/auth'
import { submitAccessRequest } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { isRequestableRole } from '@/lib/roles'

export interface RequestAccessResult {
  ok: boolean
  error?: 'unauthorized' | 'invalid_province' | 'invalid_role' | 'not_pending' | 'failed'
}

export async function requestAccessAction(input: {
  province: string
  role: string
  unitName?: string
}): Promise<RequestAccessResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'unauthorized' }

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

  if (!res.ok) return { ok: false, error: res.reason === 'not_pending' ? 'not_pending' : 'failed' }
  return { ok: true }
}
