import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  incidents,
  incidentCasualties,
  diseaseSurveillance,
  healthVisits,
  householdMembers,
  shelterAdmissions,
  infrastructures,
} from '@/db/schema'
import { SURVEILLANCE_DISEASE_LABEL } from '@/types'
import type { SitRepAuto, SurveillanceDiseaseCode, TodayCumulative } from '@/types'

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** ตัวเลข auto สำหรับใบสรุปสถานการณ์ — แยก "วันนี้" (เขตเวลาไทย) กับ "สะสม" */
export async function getSitRepAuto(incidentId: string): Promise<SitRepAuto> {
  const db = getDb()

  // ขอบเขต "วันนี้" ตามเวลาไทย
  const now = new Date()
  const bkkDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) // YYYY-MM-DD
  const startOfDay = new Date(`${bkkDate}T00:00:00+07:00`).toISOString()

  const [casualtyRows, surveillanceRows, visitRow, shelterRows, incRow, casualtyTambonRows, visitTambonRows] =
    await Promise.all([
      db
        .select({
          casualtyType: incidentCasualties.casualtyType,
          cumulative: sql<number>`count(*)`,
          today: sql<number>`coalesce(sum(case when ${incidentCasualties.observedAt} >= ${startOfDay} then 1 else 0 end), 0)`,
        })
        .from(incidentCasualties)
        .where(eq(incidentCasualties.incidentId, incidentId))
        .groupBy(incidentCasualties.casualtyType),

      db
        .select({
          code: diseaseSurveillance.diseaseCode,
          label: diseaseSurveillance.diseaseLabel,
          cumulative: sql<number>`coalesce(sum(${diseaseSurveillance.caseCount}), 0)`,
          today: sql<number>`coalesce(sum(case when ${diseaseSurveillance.reportDate} = ${bkkDate} then ${diseaseSurveillance.caseCount} else 0 end), 0)`,
        })
        .from(diseaseSurveillance)
        .where(eq(diseaseSurveillance.incidentId, incidentId))
        .groupBy(diseaseSurveillance.diseaseCode, diseaseSurveillance.diseaseLabel),

      db
        .select({
          households: sql<number>`count(distinct ${householdMembers.householdId})`,
          visitsToday: sql<number>`coalesce(sum(case when ${healthVisits.observedAt} >= ${startOfDay} then 1 else 0 end), 0)`,
        })
        .from(healthVisits)
        .leftJoin(householdMembers, eq(healthVisits.memberId, householdMembers.id))
        .where(eq(healthVisits.incidentId, incidentId)),

      db
        .select({
          shelterId: shelterAdmissions.shelterId,
          name: infrastructures.name,
          current: sql<number>`coalesce(sum(case when ${shelterAdmissions.status} = 'admitted' then 1 else 0 end), 0)`,
        })
        .from(shelterAdmissions)
        .leftJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
        .where(eq(shelterAdmissions.incidentId, incidentId))
        .groupBy(shelterAdmissions.shelterId, infrastructures.name),

      db.select({ tambon: incidents.tambon }).from(incidents).where(eq(incidents.id, incidentId)),

      db
        .selectDistinct({ tambon: incidentCasualties.tambon })
        .from(incidentCasualties)
        .where(eq(incidentCasualties.incidentId, incidentId)),

      db
        .selectDistinct({ tambon: householdMembers.tambon })
        .from(healthVisits)
        .leftJoin(householdMembers, eq(healthVisits.memberId, householdMembers.id))
        .where(eq(healthVisits.incidentId, incidentId)),
    ])

  const cBy = (t: string): TodayCumulative => {
    const r = casualtyRows.find((x) => x.casualtyType === t)
    return { today: n(r?.today), cumulative: n(r?.cumulative) }
  }
  const dead = cBy('dead')
  const missing = cBy('missing')
  const injured = cBy('injured')
  const ill = cBy('ill')
  const total: TodayCumulative = {
    today: dead.today + missing.today + injured.today + ill.today,
    cumulative: dead.cumulative + missing.cumulative + injured.cumulative + ill.cumulative,
  }

  const surveillance = surveillanceRows
    .map((r) => {
      const code = r.code as SurveillanceDiseaseCode
      const label = code === 'other' && r.label ? r.label : SURVEILLANCE_DISEASE_LABEL[code] ?? code
      return { code, label, today: n(r.today), cumulative: n(r.cumulative) }
    })
    .sort((a, b) => b.cumulative - a.cumulative)

  const tambonSet = new Set<string>()
  for (const r of casualtyTambonRows) if (r.tambon) tambonSet.add(r.tambon)
  for (const r of visitTambonRows) if (r.tambon) tambonSet.add(r.tambon)
  if (incRow[0]?.tambon) tambonSet.add(incRow[0].tambon)

  return {
    casualties: { dead, missing, injured, ill, total },
    householdsVisited: n(visitRow[0]?.households),
    visitsToday: n(visitRow[0]?.visitsToday),
    sheltersUsed: shelterRows.length,
    shelterNames: shelterRows.map((r) => r.name ?? 'ไม่ระบุชื่อ'),
    shelterCurrent: shelterRows.reduce((a, r) => a + n(r.current), 0),
    surveillance,
    affectedTambons: Array.from(tambonSet),
  }
}
