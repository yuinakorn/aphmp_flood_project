import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, sessionUserId, unauthorized } from '@/lib/field-api'
import { publicHelpReports, helpRequests } from '@/db/schema'
import { getActiveIncidentId } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import type { HelpRequestPriority } from '@/types'

const PRIORITIES = new Set<HelpRequestPriority>(['low', 'normal', 'high', 'critical'])

// PATCH /api/public-reports/[id] — จนท. ตรวจสอบคำร้องประชาชน
//   { action: 'approve', priority? }  → สร้าง help_requests จริง + ผูกกลับ
//   { action: 'reject', note? }       → ปฏิเสธ
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('id ไม่ถูกต้อง')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('ข้อมูลไม่ถูกต้อง')
  const action = body.action
  if (action !== 'approve' && action !== 'reject') return badRequest('action ต้องเป็น approve หรือ reject')

  const db = getDb()
  const [report] = await db.select().from(publicHelpReports).where(eq(publicHelpReports.id, id)).limit(1)
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (report.status !== 'pending') return badRequest('คำร้องนี้ถูกตรวจสอบไปแล้ว')

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null
  const now = new Date()

  // ── reject ──
  if (action === 'reject') {
    const [updated] = await db
      .update(publicHelpReports)
      .set({ status: 'rejected', reviewNote: note, reviewedBy: sessionUserId(session), reviewedAt: now, updatedAt: now })
      .where(eq(publicHelpReports.id, id))
      .returning()

    void audit(req, session, {
      action: 'reject_public_report',
      entity: 'public_help_report',
      targetId: id,
      metadata: { requestType: report.requestType },
    })
    return NextResponse.json({ data: updated })
  }

  // ── approve → สร้างคำร้องจริงเข้าคิว EOC ──
  const priority = typeof body.priority === 'string' && PRIORITIES.has(body.priority as HelpRequestPriority)
    ? (body.priority as HelpRequestPriority)
    : 'normal'

  const incidentId = await getActiveIncidentId()

  // ผูกบริบทผู้แจ้ง/ที่อยู่เข้ากับ description ของคำร้องจริง (จนท. เห็นครบ)
  const contextLines = [
    report.description,
    report.addressText ? `ที่อยู่: ${report.addressText}` : null,
    `ผู้แจ้ง: ${report.reporterName ?? 'ไม่ระบุชื่อ'} · โทร ${report.reporterPhone}`,
    report.peopleCount ? `จำนวน ${report.peopleCount} คน` : null,
  ].filter(Boolean)

  const [createdRequest] = await db
    .insert(helpRequests)
    .values({
      incidentId,
      memberId: null,
      requestedBy: sessionUserId(session),
      sourceRole: 'public',
      requestType: report.requestType,
      priority,
      status: 'new',
      description: `[จากประชาชน] ${contextLines.join(' · ')}`,
      lat: report.lat,
      lng: report.lng,
      observedAt: report.createdAt ?? now,
      syncedAt: now,
    })
    .returning()

  const [updated] = await db
    .update(publicHelpReports)
    .set({
      status: 'approved',
      reviewNote: note,
      reviewedBy: sessionUserId(session),
      reviewedAt: now,
      helpRequestId: createdRequest.id,
      incidentId,
      updatedAt: now,
    })
    .where(eq(publicHelpReports.id, id))
    .returning()

  void audit(req, session, {
    action: 'approve_public_report',
    entity: 'public_help_report',
    targetId: id,
    metadata: { helpRequestId: createdRequest.id, priority, incidentId },
  })

  return NextResponse.json({ data: updated, helpRequestId: createdRequest.id })
}
