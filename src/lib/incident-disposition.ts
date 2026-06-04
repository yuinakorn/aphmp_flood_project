import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { healthVisits, helpRequests, hospitalReferrals, shelterAdmissions } from '@/db/schema'
import type { DispositionSummary, IncidentDisposition } from '@/types'

// สัญญาณที่ถือว่า "active" ในแต่ละตาราง — ตรงกับ enum ใน schema.ts
const REFERRAL_ACTIVE = ['pending', 'accepted', 'en_route'] as const
const EVAC_IN_TRANSIT = ['assigned', 'en_route'] as const

function emptySummary(total = 0): DispositionSummary {
  return { total, safe: 0, atHome: 0, inTransit: 0, referred: 0, unreachable: 0 }
}

/**
 * derive disposition ของผู้เปราะบางแต่ละคน "ภายในเหตุการณ์" ตาม precedence ใน
 * docs/new/EOC-KPI-DISPOSITION-SPEC.md §3.2 (เจอข้อแรกที่ match ใช้เลย):
 *   1. active hospital_referral            → referred
 *   2. help_request evacuation in-transit  → in_transit
 *   3. active shelter_admission (admitted) → safe
 *   4. latest health_visit ในเหตุการณ์:
 *        personStatus referred             → referred
 *        personStatus evacuated|safe       → safe
 *        personStatus needs_help           → at_home
 *        visitStatus unreachable / อื่น ๆ  → unreachable
 *   5. ไม่มี contact ใด ๆ ในเหตุการณ์      → unreachable (ยังไม่ประเมิน)
 *
 * คืน Map<memberId, disposition> + summary นับรวม (รวม bucket = total เสมอ)
 */
export async function deriveDisposition(
  incidentId: string,
  memberIds: string[],
): Promise<{ byMember: Map<string, IncidentDisposition>; summary: DispositionSummary }> {
  const byMember = new Map<string, IncidentDisposition>()
  const ids = Array.from(new Set(memberIds.filter(Boolean)))
  if (ids.length === 0) return { byMember, summary: emptySummary() }

  const db = getDb()
  const [referrals, evacRequests, admissions, visits] = await Promise.all([
    db
      .select({ memberId: hospitalReferrals.memberId })
      .from(hospitalReferrals)
      .where(
        and(
          eq(hospitalReferrals.incidentId, incidentId),
          inArray(hospitalReferrals.status, [...REFERRAL_ACTIVE]),
          inArray(hospitalReferrals.memberId, ids),
        ),
      ),
    db
      .select({ memberId: helpRequests.memberId })
      .from(helpRequests)
      .where(
        and(
          eq(helpRequests.incidentId, incidentId),
          eq(helpRequests.requestType, 'evacuation'),
          inArray(helpRequests.status, [...EVAC_IN_TRANSIT]),
          inArray(helpRequests.memberId, ids),
        ),
      ),
    db
      .select({ memberId: shelterAdmissions.memberId })
      .from(shelterAdmissions)
      .where(
        and(
          eq(shelterAdmissions.incidentId, incidentId),
          eq(shelterAdmissions.status, 'admitted'),
          inArray(shelterAdmissions.memberId, ids),
        ),
      ),
    db
      .select({
        memberId: healthVisits.memberId,
        visitStatus: healthVisits.visitStatus,
        personStatus: healthVisits.personStatus,
        observedAt: healthVisits.observedAt,
      })
      .from(healthVisits)
      .where(and(eq(healthVisits.incidentId, incidentId), inArray(healthVisits.memberId, ids)))
      .orderBy(desc(healthVisits.observedAt)),
  ])

  const referredSet = new Set(referrals.map((r) => r.memberId).filter(Boolean) as string[])
  const inTransitSet = new Set(evacRequests.map((r) => r.memberId).filter(Boolean) as string[])
  const admittedSet = new Set(admissions.map((r) => r.memberId).filter(Boolean) as string[])

  // latest visit ต่อ member — rows เรียง observedAt desc แล้ว แถวแรกที่เจอ = ล่าสุด
  const latestVisit = new Map<string, { visitStatus: string; personStatus: string | null }>()
  for (const v of visits) {
    if (!v.memberId || latestVisit.has(v.memberId)) continue
    latestVisit.set(v.memberId, { visitStatus: v.visitStatus, personStatus: v.personStatus })
  }

  const summary = emptySummary(ids.length)
  for (const id of ids) {
    const d = resolveOne(id, { referredSet, inTransitSet, admittedSet, latestVisit })
    byMember.set(id, d)
    if (d === 'safe') summary.safe += 1
    else if (d === 'at_home') summary.atHome += 1
    else if (d === 'in_transit') summary.inTransit += 1
    else if (d === 'referred') summary.referred += 1
    else summary.unreachable += 1
  }

  return { byMember, summary }
}

function resolveOne(
  id: string,
  signals: {
    referredSet: Set<string>
    inTransitSet: Set<string>
    admittedSet: Set<string>
    latestVisit: Map<string, { visitStatus: string; personStatus: string | null }>
  },
): IncidentDisposition {
  if (signals.referredSet.has(id)) return 'referred'
  if (signals.inTransitSet.has(id)) return 'in_transit'
  if (signals.admittedSet.has(id)) return 'safe'

  const visit = signals.latestVisit.get(id)
  if (!visit) return 'unreachable' // ไม่มี contact ในเหตุการณ์เลย → ยังไม่ประเมิน

  switch (visit.personStatus) {
    case 'referred':
      return 'referred'
    case 'evacuated':
    case 'safe':
      return 'safe'
    case 'needs_help':
      return 'at_home'
    default:
      // visitStatus unreachable หรือ personStatus null/unknown → unreachable (ปลอดภัยไว้ก่อน, §3.3)
      return 'unreachable'
  }
}
