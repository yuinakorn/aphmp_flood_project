import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canTriage,
  forbidden,
  isUuid,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { getSitRepAuto } from '@/lib/sitrep'
import { sitReports } from '@/db/schema'
import { audit } from '@/lib/audit'
import type { SitRepManual } from '@/types'

const isDateStr = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function rowToReport(r: typeof sitReports.$inferSelect) {
  return {
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
}

// GET /api/incidents/[id]/sitrep — auto numbers + ใบรายงานล่าสุด (manual)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()

  const db = getDb()
  const [auto, rows] = await Promise.all([
    getSitRepAuto(id),
    db
      .select()
      .from(sitReports)
      .where(eq(sitReports.incidentId, id))
      .orderBy(desc(sitReports.reportDate), desc(sitReports.updatedAt))
      .limit(1),
  ])

  return NextResponse.json({ data: { auto, report: rows[0] ? rowToReport(rows[0]) : null } })
}

// POST /api/incidents/[id]/sitrep — upsert ใบรายงานของ reportDate นั้น (canTriage)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const reportDate = isDateStr(body.reportDate)
    ? body.reportDate
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  const manual =
    body.manual && typeof body.manual === 'object' ? (body.manual as Record<string, unknown>) : {}
  const status = body.status === 'published' ? 'published' : 'draft'

  const values = {
    reportTime: str(body.reportTime),
    status,
    manual,
    measures: str(body.measures),
    planNote: str(body.planNote),
    updatedAt: new Date(),
  }

  const db = getDb()
  const [existing] = await db
    .select({ id: sitReports.id })
    .from(sitReports)
    .where(and(eq(sitReports.incidentId, id), eq(sitReports.reportDate, reportDate)))
    .limit(1)

  let saved
  if (existing) {
    ;[saved] = await db
      .update(sitReports)
      .set(values)
      .where(eq(sitReports.id, existing.id))
      .returning()
  } else {
    ;[saved] = await db
      .insert(sitReports)
      .values({ incidentId: id, reportDate, createdBy: sessionUserId(session), ...values })
      .returning()
  }

  void audit(req, session, {
    action: existing ? 'update_sitrep' : 'create_sitrep',
    entity: 'sit_report',
    targetId: saved.id,
    metadata: { incidentId: id, reportDate, status: saved.status },
  })

  return NextResponse.json({ data: rowToReport(saved) }, { status: existing ? 200 : 201 })
}
