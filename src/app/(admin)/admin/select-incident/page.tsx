import { auth } from '@/lib/auth'
import { isNationalRole } from '@/lib/incident-scope'
import { SelectIncidentView } from './SelectIncidentView'

export const metadata = { title: 'เลือกเหตุการณ์ — GIS Health Intelligence' }

export default async function SelectIncidentPage() {
  const session = await auth()
  const role = session?.user?.role ?? 'viewer'
  return (
    <SelectIncidentView
      province={session?.user?.province ?? null}
      isNational={isNationalRole(role)}
    />
  )
}
