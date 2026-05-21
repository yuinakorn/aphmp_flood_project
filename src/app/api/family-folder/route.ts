import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFamilyFolderHouseholds } from '@/lib/family-folder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Re-export types so FamilyFolderClient can import them
export type { VulnerableHousehold, HouseholdMember } from '@/lib/family-folder'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const villcode = searchParams.get('villcode') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '50'))
  const offset = (page - 1) * limit

  try {
    const { households, total } = await getFamilyFolderHouseholds(limit, offset, villcode)
    return NextResponse.json({ households, total, page, limit })
  } catch (err) {
    console.error('family-folder API error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
