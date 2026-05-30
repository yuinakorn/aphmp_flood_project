import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import {
  rescueTeams,
  caseAssignments,
  healthVisits,
  helpRequests,
  shelterAdmissions,
  incidentCasualties,
  diseaseSurveillance,
} from '@/db/schema'
import { SURVEILLANCE_DISEASE_LABEL } from '@/types'
import type { IncidentCounters, SurveillanceDiseaseCode } from '@/types'

const CLOSED_DISPATCH = ['transferred', 'closed']

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/**
 * รวมตัวนับปฏิบัติการของเหตุการณ์หนึ่ง — เป็น input ให้ Sit Rep (Phase F)
 * กลุ่ม A (derive จากข้อมูลที่มีอยู่): teams, dispatches, services, requests, shelters
 * กลุ่ม B (บันทึกตรง): casualties, surveillance
 */
export async function getIncidentCounters(incidentId: string): Promise<IncidentCounters> {
  const db = getDb()

  const [teamRows, dispatchRows, serviceRows, requestRows, shelterRows, casualtyRows, surveillanceRows] =
    await Promise.all([
      // teams by status
      db
        .select({ status: rescueTeams.status, c: sql<number>`count(*)` })
        .from(rescueTeams)
        .where(eq(rescueTeams.incidentId, incidentId))
        .groupBy(rescueTeams.status),

      // dispatches (case_assignments) — join help_requests เพื่อผูก incident
      db
        .select({ status: caseAssignments.status, c: sql<number>`count(*)` })
        .from(caseAssignments)
        .innerJoin(helpRequests, eq(caseAssignments.helpRequestId, helpRequests.id))
        .where(eq(helpRequests.incidentId, incidentId))
        .groupBy(caseAssignments.status),

      // services (health_visits)
      db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`coalesce(sum(case when ${healthVisits.visitStatus} = 'completed' then 1 else 0 end), 0)`,
          needsHelp: sql<number>`coalesce(sum(case when ${healthVisits.needsHelp} then 1 else 0 end), 0)`,
        })
        .from(healthVisits)
        .where(eq(healthVisits.incidentId, incidentId)),

      // help_requests
      db
        .select({
          total: sql<number>`count(*)`,
          resolved: sql<number>`coalesce(sum(case when ${helpRequests.status} in ('resolved','cancelled') then 1 else 0 end), 0)`,
          critical: sql<number>`coalesce(sum(case when ${helpRequests.priority} = 'critical' and ${helpRequests.status} not in ('resolved','cancelled') then 1 else 0 end), 0)`,
        })
        .from(helpRequests)
        .where(eq(helpRequests.incidentId, incidentId)),

      // shelter_admissions
      db
        .select({
          sheltersUsed: sql<number>`count(distinct ${shelterAdmissions.shelterId})`,
          current: sql<number>`coalesce(sum(case when ${shelterAdmissions.status} = 'admitted' then 1 else 0 end), 0)`,
          cumulative: sql<number>`count(*)`,
          discharged: sql<number>`coalesce(sum(case when ${shelterAdmissions.status} = 'discharged' then 1 else 0 end), 0)`,
          toHospital: sql<number>`coalesce(sum(case when ${shelterAdmissions.exitReason} = 'admitted_hospital' then 1 else 0 end), 0)`,
        })
        .from(shelterAdmissions)
        .where(eq(shelterAdmissions.incidentId, incidentId)),

      // casualties by type
      db
        .select({ casualtyType: incidentCasualties.casualtyType, c: sql<number>`count(*)` })
        .from(incidentCasualties)
        .where(eq(incidentCasualties.incidentId, incidentId))
        .groupBy(incidentCasualties.casualtyType),

      // surveillance — sum cases per disease
      db
        .select({
          code: diseaseSurveillance.diseaseCode,
          label: diseaseSurveillance.diseaseLabel,
          cases: sql<number>`coalesce(sum(${diseaseSurveillance.caseCount}), 0)`,
        })
        .from(diseaseSurveillance)
        .where(eq(diseaseSurveillance.incidentId, incidentId))
        .groupBy(diseaseSurveillance.diseaseCode, diseaseSurveillance.diseaseLabel),
    ])

  const teamBy = (s: string) => n(teamRows.find((r) => r.status === s)?.c)
  const teams = {
    total: teamRows.reduce((a, r) => a + n(r.c), 0),
    active: teamBy('active'),
    standby: teamBy('standby'),
    offline: teamBy('offline'),
  }

  const dispatchTotal = dispatchRows.reduce((a, r) => a + n(r.c), 0)
  const dispatchClosed = dispatchRows
    .filter((r) => CLOSED_DISPATCH.includes(r.status))
    .reduce((a, r) => a + n(r.c), 0)
  const dispatches = {
    total: dispatchTotal,
    open: dispatchTotal - dispatchClosed,
    closed: dispatchClosed,
  }

  const sv = serviceRows[0]
  const services = {
    visits: n(sv?.total),
    completed: n(sv?.completed),
    needsHelp: n(sv?.needsHelp),
  }

  const rq = requestRows[0]
  const requests = {
    total: n(rq?.total),
    open: n(rq?.total) - n(rq?.resolved),
    resolved: n(rq?.resolved),
    critical: n(rq?.critical),
  }

  const sh = shelterRows[0]
  const shelters = {
    sheltersUsed: n(sh?.sheltersUsed),
    current: n(sh?.current),
    cumulative: n(sh?.cumulative),
    discharged: n(sh?.discharged),
    toHospital: n(sh?.toHospital),
  }

  const casualtyBy = (t: string) => n(casualtyRows.find((r) => r.casualtyType === t)?.c)
  const casualties = {
    injured: casualtyBy('injured'),
    dead: casualtyBy('dead'),
    missing: casualtyBy('missing'),
    ill: casualtyBy('ill'),
  }

  const byDisease = surveillanceRows
    .map((r) => {
      const code = r.code as SurveillanceDiseaseCode
      const label =
        code === 'other' && r.label
          ? r.label
          : SURVEILLANCE_DISEASE_LABEL[code] ?? code
      return { code, label, cases: n(r.cases) }
    })
    .sort((a, b) => b.cases - a.cases)
  const surveillance = {
    totalCases: byDisease.reduce((a, d) => a + d.cases, 0),
    byDisease,
  }

  return { teams, dispatches, services, requests, shelters, casualties, surveillance }
}
