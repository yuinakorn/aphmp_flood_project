import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canWriteFieldData } from '@/lib/field-api'
import { getActiveIncident } from '@/lib/incident-scope'
import { canSeeAllShelters } from '@/lib/shelter-access'
import { RosterView } from './RosterView'

export const dynamic = 'force-dynamic'

export default async function RosterPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user?.role ?? 'viewer'
  const scope = await getActiveIncident(role)

  return (
    <RosterView
      incident={
        scope
          ? {
              id: scope.id,
              name: scope.name,
              tambon: scope.tambon ?? null,
              amphoe: scope.amphoe ?? null,
              province: scope.province ?? null,
            }
          : null
      }
      canWrite={canWriteFieldData(role)}
      seesAllShelters={canSeeAllShelters(role)}
    />
  )
}
