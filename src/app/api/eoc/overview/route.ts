/**
 * GET /api/eoc/overview
 * ข้อมูลหน้า "ภาพรวมผู้บัญชาการ" — ribbon / donut / bars / survivability queue / shelters / coverage
 * คำนวณจากตารางจริง (ดู src/lib/overview.ts) เคารพ incident scope + ต้อง sign-in (PDPA)
 *
 * ใช้โดยหน้า server component /admin/overview ได้โดยตรงผ่าน getOverviewData()
 * route นี้ไว้ทดสอบ/ดึงจาก client ภายนอก
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getOverviewData } from '@/lib/overview'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const data = await getOverviewData(session.user.role ?? 'viewer', session.user.province ?? null)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
