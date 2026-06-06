import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { VulnerableClientView } from './VulnerableClientView'
import { AddVulnerableButton } from '@/components/forms/AddVulnerableButton'
import { canWriteFieldData } from '@/lib/field-api'
import { getActiveIncident, isNationalRole } from '@/lib/incident-scope'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { FLOOD_CENTROID } from '@/lib/flood-area'
import type { Incident, UserRole } from '@/types'

export const metadata = { title: 'จัดการกลุ่มเปราะบาง — GIS Health Intelligence' }

export default async function VulnerablePage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  const province = session?.user?.province ?? null
  const canEdit = canWriteFieldData(role)
  const national = isNationalRole(role)
  const scopeIncident = await getActiveIncident(role, province)

  // forward session cookie ให้ API เห็น role จริง (officer/admin → ข้อมูลเต็ม + uuid id)
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const cookie = (await cookies()).toString()
  const init = { cache: 'no-store' as const, headers: { cookie } }

  const [res, incRes] = await Promise.all([
    fetch(`${base}/api/vulnerable`, init),
    fetch(`${base}/api/incidents?status=active`, init),
  ])
  const persons = await res.json().catch(() => [])
  const activeIncidents: Incident[] = await incRes
    .json()
    .then((j) => j.data ?? [])
    .catch(() => [])

  const addButton = canEdit ? (
    <AddVulnerableButton
      area={{ village: null, tambon: scopeIncident?.tambon ?? null, amphoe: scopeIncident?.amphoe ?? null }}
      province={province}
      isNational={national}
      provinceOptions={national ? [...ALLOWED_PROVINCES] : []}
      defaultCenter={FLOOD_CENTROID}
      incidentName={scopeIncident?.name ?? null}
    />
  ) : null

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="gx-title">กลุ่มเปราะบาง</h1>

      <div className="mt-4">
        <VulnerableClientView
          persons={persons}
          canEdit={canEdit}
          activeIncidents={activeIncidents}
          addButton={addButton}
          isNational={national}
          userProvince={province}
        />
      </div>
    </div>
  )
}
