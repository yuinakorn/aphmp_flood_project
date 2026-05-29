/**
 * GET /api/family-folder/map
 * หมุด "บ้าน" สำหรับแผนที่ — เฉพาะครัวเรือนที่มีพิกัด + มีสมาชิกกลุ่มเปราะบาง
 * popup แสดงสมาชิกทุกคนในบ้าน + เบอร์ติดต่อ
 *
 * PDPA mask:
 *  - anonymous / viewer → เห็นแค่ count/กลุ่ม + พิกัดปัดเศษ (~1km) — ไม่เห็นชื่อ/เบอร์
 *  - officer / admin / eoc / vhv / ems / ddpm → เห็นข้อมูลเต็ม (บันทึก audit log)
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { classifyRisk } from '@/lib/geo'
import { getVulnerableHouseholdMarkers } from '@/lib/family-folder'
import { accessLog } from '@/db/schema'
import type { UserRole } from '@/types'
import floodPointsData from '../../../../../public/data/flood-points.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

const FULL_ACCESS_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm'])

export async function GET() {
  const session = await auth()
  const role = (session?.user?.role ?? 'anonymous') as UserRole
  const fullAccess = FULL_ACCESS_ROLES.has(role)

  const markers = await getVulnerableHouseholdMarkers()

  const data = markers.map((h) => {
    const risk = classifyRisk(h.lat, h.lng, floodCoords)
    if (!fullAccess) {
      // PDPA mask — ไม่มีชื่อ/เบอร์, พิกัดปัดเศษ ~1km (2 ทศนิยม)
      return {
        id: h.id,
        villno: h.villno,
        village: h.village,
        tambon: h.tambon,
        amphoe: h.amphoe,
        province: h.province,
        lat: Math.round(h.lat * 100) / 100,
        lng: Math.round(h.lng * 100) / 100,
        vulnerableCount: h.vulnerableCount,
        memberCount: h.members.length,
        risk,
        members: h.members.map((m) => ({
          group: m.group,
          isVulnerable: m.isVulnerable,
        })),
      }
    }
    return { ...h, risk }
  })

  if (fullAccess && session?.user?.id) {
    void getDb()
      .insert(accessLog)
      .values({
        userId: session.user.id,
        action: 'list_vulnerable_households',
        ip: null,
      })
      .catch(() => {})
  }

  return NextResponse.json(data)
}
