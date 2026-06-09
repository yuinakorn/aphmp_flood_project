/**
 * incident-area-match.ts — pure predicate กรอง member/แถวตามพื้นที่ผลกระทบของเหตุการณ์
 * แยกออกจาก incident-scope.ts (ซึ่ง import next/headers = server-only) เพื่อให้ client component
 * (เช่น MapClient) นำไปกรองข้อมูลใน-memory ได้โดยไม่ลาก node deps เข้ามา
 */
import type { IncidentArea } from '@/types'

/**
 * true ถ้า member อยู่ในพื้นที่ผลกระทบใด ๆ ของเหตุการณ์ (OR ข้าม area, แต่ละ area เป็น hierarchical)
 * — areas ว่าง/undefined = ไม่จำกัดพื้นที่ (match ทุกแถว)
 */
export function memberMatchesAreas(
  m: { province?: string | null; amphoe?: string | null; tambon?: string | null },
  areas: IncidentArea[] | undefined,
): boolean {
  if (!areas || areas.length === 0) return true
  return areas.some((a) => {
    if (a.province && m.province !== a.province) return false
    if (a.amphoe && m.amphoe !== a.amphoe) return false
    if (a.tambon && m.tambon !== a.tambon) return false
    return true
  })
}
