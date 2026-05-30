import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { incidents } from '@/db/schema'
import {
  canSeeClosedIncidents,
  clearIncidentCookie,
  setIncidentCookie,
} from '@/lib/incident-scope'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { incidentId?: string | null } | null
  const id = body?.incidentId ?? null

  if (!id) {
    await clearIncidentCookie()
    return NextResponse.json({ scope: null })
  }

  const db = getDb()
  const [row] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!row) return NextResponse.json({ error: 'incident not found' }, { status: 404 })

  if (!canSeeClosedIncidents(session.user?.role) && row.status === 'closed') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await setIncidentCookie(id)
  return NextResponse.json({ scope: { id: row.id, name: row.name, status: row.status } })
}
