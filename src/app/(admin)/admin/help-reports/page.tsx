import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canTriage } from '@/lib/field-api'
import { getDb } from '@/lib/db'
import { publicHelpReports } from '@/db/schema'
import { isNationalRole } from '@/lib/incident-scope'
import type { PublicHelpReport, HelpRequestType, PublicReportStatus, UserRole } from '@/types'
import { HelpReportsInbox } from './HelpReportsInbox'

export const metadata = { title: 'รับแจ้งเหตุประชาชน — GIS Health Intelligence' }
export const dynamic = 'force-dynamic'

export default async function HelpReportsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  const province = session?.user?.province ?? null
  const national = isNationalRole(role)

  const db = getDb()

  // province scope: ระดับชาติเห็นทุกจังหวัด; จังหวัดเห็นเฉพาะจังหวัดตน + ที่ไม่ระบุจังหวัด
  const provinceWhere = national || !province
    ? undefined
    : or(eq(publicHelpReports.province, province), isNull(publicHelpReports.province))

  const [pending, recent] = await Promise.all([
    db.select().from(publicHelpReports)
      .where(provinceWhere ? and(eq(publicHelpReports.status, 'pending'), provinceWhere) : eq(publicHelpReports.status, 'pending'))
      .orderBy(desc(publicHelpReports.createdAt)),
    db.select().from(publicHelpReports)
      .where(provinceWhere ? and(inArray(publicHelpReports.status, ['approved', 'rejected']), provinceWhere) : inArray(publicHelpReports.status, ['approved', 'rejected']))
      .orderBy(desc(publicHelpReports.reviewedAt))
      .limit(30),
  ])

  const map = (r: typeof pending[number]): PublicHelpReport => ({
    id: r.id,
    reporterName: r.reporterName,
    reporterPhone: r.reporterPhone,
    requestType: r.requestType as HelpRequestType,
    description: r.description,
    peopleCount: r.peopleCount,
    province: r.province,
    addressText: r.addressText,
    lat: r.lat ? Number(r.lat) : null,
    lng: r.lng ? Number(r.lng) : null,
    status: r.status as PublicReportStatus,
    reviewNote: r.reviewNote,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt?.toISOString?.() ?? null,
    helpRequestId: r.helpRequestId,
    incidentId: r.incidentId,
    createdAt: r.createdAt?.toISOString?.() ?? null,
  })

  return (
    <HelpReportsInbox
      pending={pending.map(map)}
      recent={recent.map(map)}
      canReview={canTriage(role)}
    />
  )
}
