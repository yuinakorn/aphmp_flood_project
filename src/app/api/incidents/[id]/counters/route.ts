import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { badRequest, isUuid, unauthorized } from '@/lib/field-api'
import { getIncidentCounters } from '@/lib/incident-counters'

// GET /api/incidents/[id]/counters — ตัวนับปฏิบัติการของเหตุการณ์ (input ให้ Sit Rep)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()

  const counters = await getIncidentCounters(id)
  return NextResponse.json({ data: counters })
}
