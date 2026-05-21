import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFamilyFolderSummary } from '@/lib/family-folder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type { VillageSummary } from '@/lib/family-folder'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await getFamilyFolderSummary()
    return NextResponse.json(data)
  } catch (err) {
    console.error('family-folder/summary error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
