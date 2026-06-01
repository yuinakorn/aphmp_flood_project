import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { ShieldCheck } from 'lucide-react'
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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="gx-eyebrow">ทะเบียน · PDPA-controlled</p>
          <h1 className="gx-title mt-2">กลุ่มเปราะบาง</h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            <span className="font-mono text-[var(--fg)]">{persons.length}</span> ราย · เข้าถึงทุกครั้งถูกบันทึก
            audit log
          </p>
        </div>

        {canEdit && (
          <AddVulnerableButton
            area={{ village: null, tambon: scopeIncident?.tambon ?? null, amphoe: scopeIncident?.amphoe ?? null }}
            province={province}
            isNational={national}
            provinceOptions={national ? [...ALLOWED_PROVINCES] : []}
            defaultCenter={FLOOD_CENTROID}
            incidentName={scopeIncident?.name ?? null}
          />
        )}
      </div>

      <div className="gx-note mt-6">
        <ShieldCheck
          size={16}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-[var(--signal-data)]"
        />
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
          ข้อมูลในหน้านี้คือข้อมูลส่วนบุคคลตาม PDPA
          เปิดเผยเฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต
          และทุกการดู/แก้ไขถูกบันทึกเวลา + ผู้ใช้
        </p>
      </div>

      <div className="mt-6">
        <VulnerableClientView persons={persons} canEdit={canEdit} activeIncidents={activeIncidents} />
      </div>
    </div>
  )
}
