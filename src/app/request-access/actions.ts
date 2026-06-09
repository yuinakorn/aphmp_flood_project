'use server'

import { auth } from '@/lib/auth'
import { submitAccessRequest, findStaffIdBySsoSubject, getStaffById } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { isRequestableRole } from '@/lib/roles'
import { isValidThaiCid, normalizeCid } from '@/lib/cid'
import { isUuid } from '@/lib/field-api'

export interface RequestAccessResult {
  ok: boolean
  /** เชื่อมกับบัญชีเดิม (CID ตรง) → ผู้ใช้ต้อง login ใหม่ */
  linked?: boolean
  /** บัญชีเดิมที่เชื่อมเป็น active แล้ว (เข้าใช้งานได้เลยหลัง login ใหม่) */
  linkedActive?: boolean
  error?:
    | 'unauthorized'
    | 'stale_session'
    | 'invalid_province'
    | 'invalid_role'
    | 'invalid_cid'
    | 'cid_required'
    | 'not_pending'
    | 'failed'
  /** รายละเอียดสำหรับ dev (เฉพาะ non-production) — ช่วยวินิจฉัย */
  debug?: string
}

const isDev = process.env.NODE_ENV !== 'production'

export async function requestAccessAction(input: {
  province: string
  role: string
  unitName?: string
  cid?: string
}): Promise<RequestAccessResult> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'unauthorized' }

  const sid = session.user.id
  const email = session.user.email ?? ''
  const providerIdFromEmail = email.includes('@') ? email.split('@')[0] : ''
  const providerId = (!isUuid(sid) ? sid : '') || providerIdFromEmail

  // resolve users.id:
  //  1) session.id ถ้าเป็น uuid และมี record จริง
  //  2) ไม่งั้นกู้จาก sso_subject (provider_id จาก id หรือ prefix ของ email, case-insensitive)
  //     — ครอบคลุมทั้ง session.id ที่ไม่ใช่ uuid และ uuid ที่ไม่มี record แล้ว (stale)
  let userId: string | null = null
  let recoveredVia = ''
  if (isUuid(sid) && (await getStaffById(sid).catch(() => null))) {
    userId = sid
    recoveredVia = 'session.id'
  } else if (providerId) {
    const recovered = await findStaffIdBySsoSubject(providerId)
    if (recovered) {
      userId = recovered
      recoveredVia = `sso_subject(${providerId})`
    }
  }

  if (!userId) {
    return {
      ok: false,
      error: 'stale_session',
      debug: isDev
        ? `session.id=${JSON.stringify(sid)} (isUuid=${isUuid(sid)}) · email=${JSON.stringify(email)} · ` +
          `triedSsoSubject=${JSON.stringify(providerId)} · findBySsoSubject=null`
        : undefined,
    }
  }

  if (!(ALLOWED_PROVINCES as readonly string[]).includes(input.province)) {
    return { ok: false, error: 'invalid_province' }
  }
  if (!isRequestableRole(input.role)) {
    return { ok: false, error: 'invalid_role' }
  }

  const cid = input.cid ? normalizeCid(input.cid) : ''
  if (cid && !isValidThaiCid(cid)) {
    return { ok: false, error: 'invalid_cid' }
  }

  const res = await submitAccessRequest({
    userId,
    province: input.province,
    role: input.role,
    unitName: input.unitName,
    cid: cid || null,
  })

  if (!res.ok) {
    if (res.reason === 'not_pending') return { ok: false, error: 'not_pending' }
    if (res.reason === 'cid_required') return { ok: false, error: 'cid_required' }
    // not_found — record หายไปจริง ๆ; แนบสภาพ record ปัจจุบันให้ดู
    const current = await getStaffById(userId).catch(() => null)
    return {
      ok: false,
      error: 'stale_session',
      debug: isDev
        ? `resolvedUserId=${userId} (via ${recoveredVia}) · session.id=${JSON.stringify(sid)} · ` +
          `email=${JSON.stringify(email)} · record=${current ? `{status:${current.status},via:${current.registeredVia}}` : 'NOT FOUND'} · reason=${res.reason}`
        : undefined,
    }
  }

  return { ok: true, linked: res.linked, linkedActive: res.linked ? res.canonicalActive : undefined }
}
