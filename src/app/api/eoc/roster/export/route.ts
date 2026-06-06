import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canWriteFieldData, composeName, forbidden, sessionUserId, unauthorized } from '@/lib/field-api'
import { accessLog, householdMembers, shelterAdmissions, shelterZones, infrastructures } from '@/db/schema'
import { getActiveIncident } from '@/lib/incident-scope'
import { getShelterAccessScope } from '@/lib/shelter-access'

const COLUMNS: { header: string; width: number }[] = [
  { header: 'ลำดับ', width: 6 },
  { header: 'ชื่อ-สกุล', width: 24 },
  { header: 'เลขบัตรประชาชน', width: 18 },
  { header: 'วัน/เดือน/ปีเกิด', width: 14 },
  { header: 'สัญชาติ', width: 10 },
  { header: 'โทรศัพท์', width: 14 },
  { header: 'ที่อยู่', width: 24 },
  { header: 'เพศ', width: 7 },
  { header: 'อายุ', width: 6 },
  { header: 'โรคประจำตัว', width: 18 },
  { header: 'แพ้อาหาร', width: 14 },
  { header: 'แพ้ยา', width: 14 },
  { header: 'ศูนย์พักพิง', width: 22 },
  { header: 'จุด/โซนพักพิง', width: 16 },
  { header: 'วันที่เข้าพัก', width: 13 },
  { header: 'วันที่ย้ายออก', width: 13 },
  { header: 'สถานะ', width: 11 },
  { header: 'หมายเหตุ / หน่วยงานนำส่ง', width: 24 },
]

function fmtDate(iso: Date | string | null): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return typeof iso === 'string' ? iso : ''
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Bangkok' })
}

function statusLabel(status: string, exitReason: string | null): string {
  if (exitReason === 'admitted_hospital') return 'ส่ง รพ.'
  switch (status) {
    case 'admitted': return 'พักอยู่'
    case 'transferred': return 'ส่งต่อ'
    case 'discharged': return 'ย้ายออก'
    case 'cancelled': return 'ยกเลิก'
    default: return status
  }
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'ศูนย์'
  let candidate = base
  let i = 2
  while (used.has(candidate)) candidate = `${base.slice(0, 25)} ${i++}`
  used.add(candidate)
  return candidate
}

// GET /api/eoc/roster/export?status=&shelterId=
// ส่งออกไฟล์ .xlsx ตามแบบฟอร์มราชการ 2569 — 1 ชีตต่อศูนย์ (เลขบัตรเต็ม + audit)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const scopeIncident = await getActiveIncident(session.user.role, session.user.province ?? null)
  if (!scopeIncident) return badRequest('no active incident scope')
  const incidentId = scopeIncident.id

  const access = await getShelterAccessScope(session.user.role, sessionUserId(session))
  if (!access.all && access.shelterIds.length === 0) return forbidden()

  const sp = new URL(req.url).searchParams
  const status = sp.get('status')
  const shelterIdParam = sp.get('shelterId')

  const conditions = [eq(shelterAdmissions.incidentId, incidentId)]
  if (status === 'current') conditions.push(eq(shelterAdmissions.status, 'admitted'))
  else if (status && status !== 'all') conditions.push(eq(shelterAdmissions.status, status))

  let allowedShelterIds: string[] | null = access.all ? null : access.shelterIds
  if (shelterIdParam) {
    if (allowedShelterIds && !allowedShelterIds.includes(shelterIdParam)) return forbidden()
    allowedShelterIds = [shelterIdParam]
  }
  if (allowedShelterIds) conditions.push(inArray(shelterAdmissions.shelterId, allowedShelterIds))

  const db = getDb()
  const rows = await db
    .select({
      adm: shelterAdmissions,
      zoneName: shelterZones.name,
      shelterName: infrastructures.name,
      m: householdMembers,
    })
    .from(shelterAdmissions)
    .leftJoin(shelterZones, eq(shelterAdmissions.zoneId, shelterZones.id))
    .leftJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
    .leftJoin(householdMembers, eq(shelterAdmissions.memberId, householdMembers.id))
    .where(and(...conditions))
    .orderBy(asc(infrastructures.name), desc(shelterAdmissions.admittedAt))

  // group by shelter
  const groups = new Map<string, { name: string; rows: typeof rows }>()
  for (const r of rows) {
    const sid = r.adm.shelterId
    let g = groups.get(sid)
    if (!g) {
      g = { name: r.shelterName ?? 'ไม่ระบุชื่อศูนย์', rows: [] }
      groups.set(sid, g)
    }
    g.rows.push(r)
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'ระบบภูมิสารสนเทศสุขภาพ'
  wb.created = new Date()
  const usedNames = new Set<string>()
  const lastCol = COLUMNS.length

  // ถ้าไม่มีศูนย์เลย — สร้างชีตว่าง 1 ชีต
  const entries = groups.size > 0 ? Array.from(groups.values()) : [{ name: 'ไม่มีข้อมูล', rows: [] as typeof rows }]

  for (const g of entries) {
    const ws = wb.addWorksheet(sanitizeSheetName(g.name, usedNames), {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    })

    const current = g.rows.filter((r) => r.adm.status === 'admitted').length
    const discharged = g.rows.filter((r) => r.adm.status === 'discharged').length
    const toHospital = g.rows.filter((r) => r.adm.exitReason === 'admitted_hospital').length

    const titleRow = (text: string, bold = false, size = 11) => {
      const row = ws.addRow([text])
      ws.mergeCells(row.number, 1, row.number, lastCol)
      row.getCell(1).font = { bold, size }
      row.getCell(1).alignment = { horizontal: 'center' }
    }
    titleRow('แบบบันทึกผู้พักพิงรายวัน', true, 14)
    titleRow(`ศูนย์พักพิงชั่วคราว ${g.name}`, true, 12)
    const loc = [scopeIncident.tambon && `ต.${scopeIncident.tambon}`, scopeIncident.amphoe && `อ.${scopeIncident.amphoe}`, scopeIncident.province && `จ.${scopeIncident.province}`].filter(Boolean).join(' ')
    titleRow(`เหตุการณ์: ${scopeIncident.name}${loc ? ` · ${loc}` : ''}`)
    titleRow('ผู้รับผิดชอบประจำวัน / ผู้รวบรวม ...........................................................')
    titleRow(`วันที่ออกรายงาน ${fmtDate(new Date())}`)

    const summary = (label: string, value: number) => {
      const row = ws.addRow([label, value])
      row.getCell(1).font = { bold: true }
    }
    summary('สรุปจำนวนผู้พักปัจจุบัน (คน)', current)
    summary('สะสมทั้งหมด (คน)', g.rows.length)
    summary('ย้ายออกแล้ว (คน)', discharged)
    summary('ส่งต่อ รพ. (คน)', toHospital)

    ws.addRow([])

    const header = ws.addRow(COLUMNS.map((c) => c.header))
    header.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    })
    COLUMNS.forEach((c, i) => { ws.getColumn(i + 1).width = c.width })

    g.rows.forEach((r, idx) => {
      const m = r.m
      const addr = m
        ? [m.hno ? `เลขที่ ${m.hno}` : null, m.villno ? `หมู่ ${m.villno}` : null, m.tambon ? `ต.${m.tambon}` : null].filter(Boolean).join(' ')
        : ''
      const dataRow = ws.addRow([
        idx + 1,
        m ? composeName(m.prefix, m.firstName, m.lastName) : '',
        m?.nationalId ?? '',
        fmtDate(m?.birthDate ?? null),
        m?.nationality ?? '',
        m?.phone ?? '',
        addr,
        m?.sex ?? '',
        m?.age ?? '',
        m?.cond ?? '',
        m?.foodAllergy ?? '',
        m?.drugAllergy ?? '',
        r.shelterName ?? '',
        r.zoneName ?? r.adm.intakePoint ?? '',
        fmtDate(r.adm.admittedAt),
        fmtDate(r.adm.dischargedAt),
        statusLabel(r.adm.status, r.adm.exitReason),
        r.adm.broughtByText ?? r.adm.exitDestination ?? r.adm.notes ?? '',
      ])
      dataRow.getCell(3).numFmt = '@' // เลขบัตรเป็นข้อความ ไม่ใช่ตัวเลข
      dataRow.eachCell((cell) => {
        cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } }
        cell.alignment = { vertical: 'middle', wrapText: true }
      })
    })
  }

  // audit: บันทึกการ export (เปิดเผยเลขบัตรเต็ม)
  void db
    .insert(accessLog)
    .values({ userId: sessionUserId(session), action: 'export_roster', targetId: incidentId, ip: null })
    .catch(() => {})

  const buffer = await wb.xlsx.writeBuffer()
  const fname = `roster_${scopeIncident.name}_${fmtDate(new Date())}.xlsx`.replace(/[^\w.\-ก-๙]+/g, '_')

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  })
}
