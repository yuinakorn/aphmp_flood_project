import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { canTriage } from '@/lib/field-api'
import type { HospitalReferral, UserRole } from '@/types'
import { ReferralsInbox } from './ReferralsInbox'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ส่งต่อโรงพยาบาล — GIS Health Intelligence' }

export default async function ReferralsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user?.role ?? 'viewer') as UserRole
  if (!canTriage(role)) redirect('/admin/eoc')

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const cookie = (await cookies()).toString()
  const res = await fetch(`${base}/api/referrals`, { cache: 'no-store', headers: { cookie } })
  const initial: HospitalReferral[] = await res.json().then((j) => j.data ?? []).catch(() => [])

  return <ReferralsInbox initial={initial} />
}
