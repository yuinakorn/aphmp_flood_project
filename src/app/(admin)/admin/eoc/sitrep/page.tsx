import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getActiveIncident } from '@/lib/incident-scope'
import { getSitRepAuto } from '@/lib/sitrep'
import { canTriage } from '@/lib/field-api'
import { sitReports } from '@/db/schema'
import { SitRepView } from './SitRepView'
import type { SitRepManual, SitReport, UserRole } from '@/types'

export const metadata = { title: 'ใบสรุปสถานการณ์ Sit Rep — GIS Health Intelligence' }

export default async function SitRepPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  const scope = await getActiveIncident(role)

  if (!scope) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <h1 className="gx-title">ใบสรุปสถานการณ์ (Sit Rep)</h1>
        <p className="mt-3 text-[var(--fg-muted)]">
          ต้องเลือกเหตุการณ์ที่กำลังจัดการก่อน — เลือกได้จากแถบเหตุการณ์ด้านบน แล้วกลับมาหน้านี้อีกครั้ง
        </p>
        <Link href="/admin/eoc" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
          <ArrowLeft size={15} /> กลับศูนย์บัญชาการ EOC
        </Link>
      </div>
    )
  }

  const db = getDb()
  const [auto, rows] = await Promise.all([
    getSitRepAuto(scope.id),
    db
      .select()
      .from(sitReports)
      .where(eq(sitReports.incidentId, scope.id))
      .orderBy(desc(sitReports.reportDate), desc(sitReports.updatedAt))
      .limit(1),
  ])

  const r = rows[0]
  const report: SitReport | null = r
    ? {
        id: r.id,
        incidentId: r.incidentId,
        reportDate: r.reportDate,
        reportTime: r.reportTime,
        status: r.status as 'draft' | 'published',
        manual: (r.manual ?? {}) as SitRepManual,
        measures: r.measures,
        planNote: r.planNote,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      }
    : null

  return (
    <SitRepView
      incident={scope}
      auto={auto}
      report={report}
      canEdit={canTriage(role)}
    />
  )
}
