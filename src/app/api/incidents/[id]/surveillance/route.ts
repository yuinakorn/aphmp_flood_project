import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
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
import { diseaseSurveillance } from '@/db/schema'
import { audit } from '@/lib/audit'

const DISEASE_CODES = new Set([
  'foot_immersion',
  'diarrhea',
  'fever',
  'conjunctivitis',
  'respiratory',
  'stress',
  'leptospirosis',
  'other',
])

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const isDateStr = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

// GET /api/incidents/[id]/surveillance — รายการบันทึกโรคเฝ้าระวัง (canTriage)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const db = getDb()
  const rows = await db
    .select()
    .from(diseaseSurveillance)
    .where(eq(diseaseSurveillance.incidentId, id))
    .orderBy(desc(diseaseSurveillance.reportDate))
  return NextResponse.json({ data: rows })
}

// POST /api/incidents/[id]/surveillance — บันทึกยอดผู้ป่วยกลุ่มอาการ 1 รายการ (canTriage)
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

  const diseaseCode = str(body.diseaseCode)
  if (!diseaseCode || !DISEASE_CODES.has(diseaseCode)) {
    return badRequest('Invalid diseaseCode')
  }

  const caseCountRaw = body.caseCount
  const caseCount =
    typeof caseCountRaw === 'number' && Number.isFinite(caseCountRaw) && caseCountRaw >= 0
      ? Math.trunc(caseCountRaw)
      : null
  if (caseCount === null) return badRequest('caseCount must be a non-negative number')

  const reportDate = isDateStr(body.reportDate)
    ? body.reportDate
    : new Date().toISOString().slice(0, 10)

  const shelterId = str(body.shelterId)
  if (shelterId && !isUuid(shelterId)) return badRequest('shelterId must be a UUID')

  const db = getDb()
  const [created] = await db
    .insert(diseaseSurveillance)
    .values({
      incidentId: id,
      diseaseCode,
      diseaseLabel: diseaseCode === 'other' ? str(body.diseaseLabel) : null,
      caseCount,
      reportDate,
      tambon: str(body.tambon),
      amphoe: str(body.amphoe),
      shelterId,
      notes: str(body.notes),
      reportedBy: sessionUserId(session),
    })
    .returning()

  void audit(req, session, {
    action: 'create_surveillance',
    entity: 'disease_surveillance',
    targetId: created.id,
    metadata: { incidentId: id, diseaseCode: created.diseaseCode, caseCount: created.caseCount },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
