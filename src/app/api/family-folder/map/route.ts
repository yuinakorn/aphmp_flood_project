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
import { classifyRiskByPolygons } from '@/lib/geo'
import { loadRiskZonesByProvince, zonesFor } from '@/lib/flood-risk'
import { getVulnerableHouseholdMarkers } from '@/lib/family-folder'
import { isNationalRole } from '@/lib/incident-scope'
import { accessLog } from '@/db/schema'
import type { UserRole } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FULL_ACCESS_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm'])

export async function GET() {
  const session = await auth()
  const role = (session?.user?.role ?? 'anonymous') as UserRole
  const fullAccess = FULL_ACCESS_ROLES.has(role)

  // province scope — ผู้ใช้ที่ไม่ใช่ระดับชาติ เห็นเฉพาะจังหวัดสังกัด
  const national = isNationalRole(role)
  const sessionProvince = session?.user?.province ?? null
  if (session?.user && !national && !sessionProvince) return NextResponse.json([])
  const scopedProvince = session?.user && !national ? sessionProvince : null

  const markers = await getVulnerableHouseholdMarkers(scopedProvince)
  const zonesByProvince = await loadRiskZonesByProvince()

  const data = markers.map((h) => {
    const risk = classifyRiskByPolygons(h.lat, h.lng, zonesFor(zonesByProvince, h.province))
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
          categories: m.categories,
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
