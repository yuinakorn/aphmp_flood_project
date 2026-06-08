import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { badRequest } from '@/lib/field-api'
import { publicHelpReports } from '@/db/schema'
import { REQUEST_TYPE_SET } from '@/lib/help-request-labels'
import { audit } from '@/lib/audit'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { clientIp } from '@/lib/request-ip'
import { rateLimit } from '@/lib/rate-limit'
import type { HelpRequestType } from '@/types'

// ── ขอบเขตประเทศไทย (กันพิกัดขยะ) ──
const TH_LAT = [5, 21] as const
const TH_LNG = [97, 106] as const

// ── เพดาน rate-limit (defense in depth) ──
const BURST_LIMIT = 5           // ต่อ IP ต่อ นาที (ด่าน in-memory) — เผื่อพื้นที่ที่คนแชร์เน็ตกัน
const BURST_WINDOW_MS = 60_000  // 1 นาที
const HOURLY_LIMIT = 30         // ต่อ IP ต่อ ชม. (ด่าน durable นับจาก DB)

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'ส่งคำร้องบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  )
}

// POST /api/public-reports — ประชาชนแจ้งเหตุผ่านฟอร์มสาธารณะ (ไม่ต้อง login)
// คำร้องเข้าสถานะ pending รอ จนท. ตรวจสอบก่อนเข้าคิว EOC
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const ipKey = `public-report:${ip ?? 'unknown'}`

  // ด่าน 1 — in-memory burst guard (เร็ว ไม่แตะ DB)
  const burst = rateLimit(ipKey, BURST_LIMIT, BURST_WINDOW_MS)
  if (!burst.ok) return tooMany(burst.retryAfterSec)

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('ข้อมูลไม่ถูกต้อง')

  // honeypot — บอททั่วไปจะกรอกช่องที่ซ่อนไว้; คนจริงเว้นว่าง → ตอบ ok เงียบ ๆ ไม่บันทึก
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true }, { status: 201 })
  }

  const reporterPhone = typeof body.reporterPhone === 'string' ? body.reporterPhone.trim() : ''
  if (!/^[0-9+\-\s]{6,20}$/.test(reporterPhone)) {
    return badRequest('กรุณากรอกเบอร์ติดต่อกลับให้ถูกต้อง')
  }

  const requestType = typeof body.requestType === 'string' ? body.requestType : ''
  if (!REQUEST_TYPE_SET.has(requestType as HelpRequestType)) {
    return badRequest('กรุณาเลือกประเภทความช่วยเหลือ')
  }

  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

  const province =
    typeof body.province === 'string' && (ALLOWED_PROVINCES as readonly string[]).includes(body.province)
      ? body.province
      : null

  // พิกัด — รับเฉพาะที่อยู่ในขอบเขตไทย; นอกเขต/ขยะ → ทิ้งพิกัด (ไม่ปฏิเสธคำร้อง)
  let lat: number | null = body.lat == null ? null : Number(body.lat)
  let lng: number | null = body.lng == null ? null : Number(body.lng)
  const inBounds =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= TH_LAT[0] && lat <= TH_LAT[1] && lng >= TH_LNG[0] && lng <= TH_LNG[1]
  if (!inBounds) { lat = null; lng = null }

  const peopleCountRaw = Number(body.peopleCount)
  const peopleCount =
    Number.isFinite(peopleCountRaw) && peopleCountRaw > 0
      ? Math.min(Math.floor(peopleCountRaw), 1000) // cap กันค่าเว่อร์
      : null

  const db = getDb()

  // ด่าน 2 — durable: นับคำร้องจาก IP เดียวกันใน 1 ชม.ที่ผ่านมา (ข้าม instance/รอด redeploy)
  if (ip) {
    const since = new Date(Date.now() - 60 * 60_000)
    const [{ c } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(publicHelpReports)
      .where(and(eq(publicHelpReports.ip, ip), gte(publicHelpReports.createdAt, since)))
    if (Number(c) >= HOURLY_LIMIT) return tooMany(600)
  }

  const [created] = await db
    .insert(publicHelpReports)
    .values({
      reporterName: str(body.reporterName, 120),
      reporterPhone,
      requestType,
      description: str(body.description, 1000),
      peopleCount,
      province,
      addressText: str(body.addressText, 300),
      lat: lat === null ? null : String(lat),
      lng: lng === null ? null : String(lng),
      status: 'pending',
      ip: ip ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
    .returning({ id: publicHelpReports.id })

  void audit(req, null, {
    action: 'create_public_report',
    entity: 'public_help_report',
    targetId: created.id,
    metadata: { requestType, province },
  })

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
}
