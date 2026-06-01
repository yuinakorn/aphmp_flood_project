import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { incidents } from '@/db/schema'
import {
  canSeeClosedIncidents,
  clearIncidentCookie,
  isNationalRole,
  NORMAL_SCOPE,
  setIncidentCookie,
  setNormalScopeCookie,
} from '@/lib/incident-scope'

// DELETE /api/incident-scope — ล้าง scope (ใช้ตอน login ใหม่ → บังคับเลือกใหม่ผ่าน gate)
export async function DELETE() {
  await clearIncidentCookie()
  return NextResponse.json({ scope: null })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { incidentId?: string | null } | null
  const id = body?.incidentId ?? null

  // null หรือ 'normal' = เลือกโหมดปกติทั้งจังหวัด (ไม่ผูกเหตุการณ์) — เก็บ sentinel ไว้ให้ gate ผ่าน
  if (!id || id === NORMAL_SCOPE) {
    await setNormalScopeCookie()
    return NextResponse.json({ scope: 'normal' })
  }

  const db = getDb()
  const [row] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!row) return NextResponse.json({ error: 'incident not found' }, { status: 404 })

  if (!canSeeClosedIncidents(session.user?.role) && row.status === 'closed') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // province guard — non-national ตั้ง scope ได้เฉพาะเหตุการณ์ในจังหวัดสังกัด
  if (!isNationalRole(session.user?.role) && row.province !== (session.user?.province ?? null)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await setIncidentCookie(id)
  return NextResponse.json({ scope: { id: row.id, name: row.name, status: row.status } })
}
