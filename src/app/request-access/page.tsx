import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getStaffById } from '@/lib/staff-auth'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { RequestAccessClient } from './RequestAccessClient'

export const metadata = { title: 'ขอสิทธิ์เข้าใช้งาน' }

export default async function RequestAccessPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.status === 'active') redirect('/admin')

  // โหลด record ปัจจุบัน — รู้ว่าส่งคำขอไปแล้วหรือยัง (province ถูกตั้งค่า = ส่งแล้ว)
  const record = session.user.id ? await getStaffById(session.user.id) : null

  return (
    <RequestAccessClient
      name={session.user.name ?? ''}
      status={(record?.status as 'pending' | 'suspended') ?? 'pending'}
      submitted={Boolean(record?.province)}
      currentProvince={record?.province ?? ''}
      currentRole={record?.role ?? ''}
      currentUnitName={record?.unitName ?? ''}
      provinces={[...ALLOWED_PROVINCES]}
    />
  )
}
