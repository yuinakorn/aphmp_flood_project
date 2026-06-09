import { auth } from '@/lib/auth'
import { canManageIncident } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import type { UserRole } from '@/types'
import { IncidentsClient } from '../../incidents/IncidentsClient'

export const metadata = { title: 'เหตุการณ์ภัยพิบัติ — ตั้งค่า' }

export default async function SettingsIncidentsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  const national = isNationalRole(role)
  return (
    <IncidentsClient
      canCreate={canManageIncident(role)}
      province={session?.user?.province ?? null}
      isNational={national}
      provinceOptions={national ? [...ALLOWED_PROVINCES] : []}
    />
  )
}
