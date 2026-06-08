import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { FamilyFolderClient } from './FamilyFolderClient'
import { getFamilyFolderSummary, getFamilyFolderHouseholds } from '@/lib/family-folder'
import { getActiveIncident } from '@/lib/incident-scope'

export const metadata = { title: 'Family Folder กลุ่มเปราะบาง — GIS Health Intelligence' }

export default async function FamilyFolderPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user?.role ?? 'viewer'
  const province = session.user?.province ?? null
  const scope = await getActiveIncident(role, province)
  const isCrisis = !!scope

  const [summary, { households, total }] = await Promise.all([
    getFamilyFolderSummary(),
    getFamilyFolderHouseholds(300, 0, undefined, { withRisk: isCrisis }),
  ])

  return (
    <FamilyFolderClient
      summary={summary}
      initialHouseholds={households}
      total={total}
      isCrisis={isCrisis}
      incidentName={scope?.name ?? null}
    />
  )
}
