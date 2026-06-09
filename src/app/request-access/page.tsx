import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getStaffById, findStaffIdBySsoSubject } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { isUuid } from '@/lib/field-api'
import { RequestAccessClient } from './RequestAccessClient'

export const metadata = { title: 'ขอสิทธิ์เข้าใช้งาน' }

export default async function RequestAccessPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.status === 'active') redirect('/admin')

  // resolve record: ปกติจาก session.user.id (uuid); ถ้าไม่เจอ (session เก่า/fallback/stale)
  // → กู้จาก sso_subject (provider_id จาก id หรือ prefix ของ email, case-insensitive)
  const sid = session.user.id
  let record = sid && isUuid(sid) ? await getStaffById(sid) : null
  if (!record) {
    const providerId = (sid && !isUuid(sid) ? sid : '') || session.user.email?.split('@')[0] || ''
    const recoveredId = providerId ? await findStaffIdBySsoSubject(providerId) : null
    record = recoveredId ? await getStaffById(recoveredId) : null
  }

  return (
    <RequestAccessClient
      name={session.user.name ?? ''}
      status={(record?.status as 'pending' | 'suspended') ?? 'pending'}
      submitted={Boolean(record?.province)}
      needsCid={!record?.cidHash}
      currentProvince={record?.province ?? ''}
      currentRole={record?.role ?? ''}
      currentUnitName={record?.unitName ?? ''}
      provinces={[...ALLOWED_PROVINCES]}
    />
  )
}
