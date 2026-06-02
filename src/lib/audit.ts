/**
 * audit.ts — บันทึก audit log แบบรวมศูนย์ (PDPA + ความปลอดภัย)
 *
 * เรียกบรรทัดเดียวต่อ mutation: `void audit(req, session, { action, entity, targetId, metadata })`
 * - fire-and-forget: ไม่ throw / ไม่ block request (ถ้า log ล้มเหลว request ยังสำเร็จ)
 * - ดึง ip + user-agent จาก headers อัตโนมัติ
 * - metadata: เก็บ context (id/status/count) เท่านั้น — ห้ามใส่ PII ดิบ (เลขบัตร/ชื่อ-สกุล/พิกัดบ้าน)
 */
import type { Session } from 'next-auth'
import { getDb } from '@/lib/db'
import { accessLog } from '@/db/schema'
import { isUuid } from '@/lib/field-api'

interface AuditEntry {
  action: string                     // เช่น create_incident | transfer_admission | reveal_national_id
  entity?: string                    // ชนิด entity เช่น incident | shelter_admission | referral
  targetId?: string | null           // id ของ entity (ต้องเป็น uuid; ถ้าไม่ใช่จะข้าม)
  metadata?: Record<string, unknown> // context เพิ่มเติม (ไม่มี PII)
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

export async function audit(
  req: Request | { headers: Headers },
  session: Session | null,
  entry: AuditEntry,
): Promise<void> {
  try {
    const userId = session?.user?.id
    const role = (session?.user as { role?: string } | undefined)?.role ?? null
    const headers = (req as Request).headers
    const ua = headers?.get?.('user-agent') ?? null
    const ip = (req as Request).url !== undefined ? clientIp(req as Request) : null

    await getDb()
      .insert(accessLog)
      .values({
        userId: typeof userId === 'string' && isUuid(userId) ? userId : null,
        role,
        action: entry.action,
        entity: entry.entity ?? null,
        targetId: entry.targetId && isUuid(entry.targetId) ? entry.targetId : null,
        method: (req as Request).method ?? null,
        metadata: entry.metadata ?? null,
        ip,
        userAgent: ua,
      })
  } catch {
    // never break the request because of audit failure
  }
}
