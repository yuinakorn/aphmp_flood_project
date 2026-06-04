/**
 * Data layer ของ "คิวสั่งการ + บริบทสถานการณ์" ในศูนย์บัญชาการ EOC (/admin/eoc)
 * (เดิมเป็นหน้า /admin/overview ที่ถูกรวมเข้า EOC แล้ว)
 * คำนวณจากตารางจริง — reuse `classifyRisk`/`haversineKm` (geo.ts) + `getActiveIncident` (incident scope)
 *
 * หลัก (ดู docs/new/DATA-SPEC-overview.md):
 *  - คะแนน survivability ใช้เฉพาะ input ที่เก็บได้จริง + confidence + degrade (ไม่มี HIS countdown)
 *  - spatial = point-based ผ่าน flood-points.json เดิม (ไม่แตะ /map, ไม่ใช้ PostGIS)
 *  - ทุกตัวเลข scope ด้วย incident ที่กำลังจัดการ (โหมดวิกฤต)
 */
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { classifyRisk, haversineKm } from '@/lib/geo'
import { getActiveIncident, areaMemberWhere } from '@/lib/incident-scope'
import {
  householdMembers,
  shelterAdmissions,
  helpRequests,
  rescueTeams,
  infrastructures,
} from '@/db/schema'
import type { Incident, RiskLevel } from '@/types'
import floodPointsData from '../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

// น้ำหนักความเร่งด่วนของอุปกรณ์พยุงชีพ (flag คงที่ อสม.กรอก — ไม่มี countdown)
const LIFE_WEIGHT: Record<string, number> = {
  oxygen: 1.0,
  ventilator: 1.0,
  dialysis_hd: 0.9,
  dialysis_capd: 0.85,
  anti_seizure: 0.6,
  feeding_tube: 0.5,
}
const SHELTER_TYPES = ['shelter', 'assembly', 'temporary_health_post']

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

// ───────── public types ─────────
export type OverviewMode = 'crisis' | 'normal'
export type Priority = 'P1' | 'P2' | 'P3' | 'unknown'

export interface QueueMember {
  name: string
  age: number | null
  lifeSupport: string[]
  isCaregiver: boolean
  phone: string | null
}
export interface QueueHousehold {
  key: string
  headMemberId: string
  contactPhone: string | null
  hno: string | null
  villno: string | null
  village: string | null
  tambon: string | null
  amphoe: string | null
  memberCount: number
  members: QueueMember[]
  risk: RiskLevel
  distanceM: number | null
  lifeSupport: string[]
  hasCaregiver: boolean
  lastContactedAt: string | null
  hoursSinceContact: number | null
  notEvacuated: boolean
  openRequest: boolean
  score: number
  priority: Priority
  confidence: number
  suggestedTeam: { name: string; zone: string | null } | null
}
export interface ShelterRow {
  id: string
  name: string
  contact: string | null
  occupancy: number
  capacity: number | null
  pct: number
  bedriddenCapacity: number | null
  bedriddenUsed: number
  oxygenSupport: boolean
}
export interface OverviewData {
  mode: OverviewMode
  incident: Pick<Incident, 'id' | 'name' | 'status'> | null
  ribbon: {
    total: number
    inFlood: number
    lifeSupport: number
    lifeSupportBreak: { oxygen: number; dialysis: number; other: number }
    pendingReferral: number
    inShelter: number
    teams: number
  }
  banner: { lifeSupportNotEvacuated: number }
  donut: { inFlood: number; near: number; inShelter: number; safe: number; total: number }
  groups: { type: string; label: string; total: number; inFlood: number }[]
  queue: QueueHousehold[]
  sheltersNearFull: ShelterRow[]
}

const TYPE_LABEL: Record<string, string> = {
  bedridden: 'ติดเตียง',
  elderly: 'ผู้สูงอายุติดบ้าน',
  disabled: 'พิการ',
  pregnant: 'ตั้งครรภ์',
  other: 'อื่นๆ',
}

export async function getOverviewData(
  role: string | null | undefined,
  province: string | null | undefined,
): Promise<OverviewData> {
  const db = getDb()
  const incident = await getActiveIncident(role, province)
  const mode: OverviewMode = incident ? 'crisis' : 'normal'
  const now = Date.now()

  // ── 1) สมาชิกในทะเบียนดูแล (scope ตามพื้นที่ผลกระทบของ incident ถ้ามี — รองรับหลายอำเภอ/ตำบล) ──
  const memberWhere = [isNotNull(householdMembers.type), isNull(householdMembers.deletedAt)]
  if (incident?.areas?.length) {
    const areaCond = areaMemberWhere(incident.areas, {
      province: householdMembers.province,
      amphoe: householdMembers.amphoe,
      tambon: householdMembers.tambon,
    })
    if (areaCond) memberWhere.push(areaCond)
  }

  const members = await db
    .select({
      id: householdMembers.id,
      householdId: householdMembers.householdId,
      prefix: householdMembers.prefix,
      firstName: householdMembers.firstName,
      lastName: householdMembers.lastName,
      age: householdMembers.age,
      type: householdMembers.type,
      isChronic: householdMembers.isChronic,
      isDisabled: householdMembers.isDisabled,
      isHead: householdMembers.isHead,
      familyPosition: householdMembers.familyPosition,
      lifeSupport: householdMembers.lifeSupport,
      phone: householdMembers.phone,
      caregiverPhone: householdMembers.caregiverPhone,
      hno: householdMembers.hno,
      villno: householdMembers.villno,
      village: householdMembers.village,
      tambon: householdMembers.tambon,
      amphoe: householdMembers.amphoe,
      lat: householdMembers.lat,
      lng: householdMembers.lng,
      lastContactedAt: householdMembers.lastContactedAt,
    })
    .from(householdMembers)
    .where(and(...memberWhere))

  // ── 2) ใครอพยพเข้าศูนย์แล้ว / มีคำร้องส่งต่อค้าง (เฉพาะมี incident) ──
  let evacuated = new Set<string>()
  let openReferral = new Set<string>()
  let teams: { name: string; zone: string | null }[] = []
  if (incident) {
    const [admRows, reqRows, teamRows] = await Promise.all([
      db
        .select({ memberId: shelterAdmissions.memberId })
        .from(shelterAdmissions)
        .where(and(eq(shelterAdmissions.incidentId, incident.id), eq(shelterAdmissions.status, 'admitted'))),
      db
        .select({ memberId: helpRequests.memberId })
        .from(helpRequests)
        .where(
          and(
            eq(helpRequests.incidentId, incident.id),
            inArray(helpRequests.requestType, ['medical', 'evacuation', 'rescue']),
            sql`${helpRequests.status} not in ('resolved','cancelled')`,
          ),
        ),
      db
        .select({ name: rescueTeams.name, zone: rescueTeams.zone })
        .from(rescueTeams)
        .where(and(eq(rescueTeams.incidentId, incident.id), sql`${rescueTeams.status} <> 'offline'`)),
    ])
    evacuated = new Set(admRows.map((r) => r.memberId).filter(Boolean) as string[])
    openReferral = new Set(reqRows.map((r) => r.memberId).filter(Boolean) as string[])
    teams = teamRows.map((t) => ({ name: t.name, zone: t.zone ?? null }))
  }

  // ── 3) per-member derive: risk, distance, lifeSupport ──
  type M = (typeof members)[number] & { risk: RiskLevel; distM: number | null; ls: string[] }
  const enriched: M[] = members.map((m) => {
    const lat = num(m.lat)
    const lng = num(m.lng)
    let risk: RiskLevel = 'safe'
    let distM: number | null = null
    if (lat !== null && lng !== null) {
      risk = classifyRisk(lat, lng, floodCoords)
      let best = Infinity
      for (const [fLat, fLng] of floodCoords) {
        const d = haversineKm(lat, lng, fLat, fLng)
        if (d < best) best = d
      }
      distM = best === Infinity ? null : Math.round(best * 1000)
    }
    const ls = Array.isArray(m.lifeSupport) ? (m.lifeSupport as string[]) : []
    return { ...m, risk, distM, ls }
  })

  // ── 4) ribbon + donut + bars (นับราย "คน") ──
  const isEvac = (id: string) => evacuated.has(id)
  let inFlood = 0
  let near = 0
  let inShelter = 0
  let safe = 0
  let lifeSupportCount = 0
  let lsOxygen = 0
  let lsDialysis = 0
  let lsOther = 0
  const groupMap = new Map<string, { total: number; inFlood: number }>()
  for (const m of enriched) {
    // donut disposition
    if (isEvac(m.id)) inShelter++
    else if (m.risk === 'flood') inFlood++
    else if (m.risk === 'near') near++
    else safe++
    // life support
    if (m.ls.length > 0) {
      lifeSupportCount++
      if (m.ls.includes('oxygen') || m.ls.includes('ventilator')) lsOxygen++
      else if (m.ls.includes('dialysis_capd') || m.ls.includes('dialysis_hd')) lsDialysis++
      else lsOther++
    }
    // bars by type
    const t = m.type ?? 'other'
    const g = groupMap.get(t) ?? { total: 0, inFlood: 0 }
    g.total++
    if (m.risk === 'flood' && !isEvac(m.id)) g.inFlood++
    groupMap.set(t, g)
  }
  const inFloodTotal = enriched.filter((m) => m.risk === 'flood' && !isEvac(m.id)).length

  const groups = [...groupMap.entries()]
    .map(([type, v]) => ({ type, label: TYPE_LABEL[type] ?? type, total: v.total, inFlood: v.inFlood }))
    .sort((a, b) => b.total - a.total)

  // pending referral (รายคนที่มีคำร้องส่งต่อค้าง)
  const pendingReferral = openReferral.size

  // ── 5) survivability queue (group เป็นครัวเรือน) ──
  const houseMap = new Map<string, M[]>()
  for (const m of enriched) {
    const key = m.householdId ?? `solo:${m.id}`
    const arr = houseMap.get(key) ?? []
    arr.push(m)
    houseMap.set(key, arr)
  }

  const queue: QueueHousehold[] = []
  let lifeSupportNotEvacuated = 0
  for (const [key, ms] of houseMap) {
    const notEvacuated = ms.every((m) => !isEvac(m.id))
    if (!notEvacuated) continue // อพยพแล้ว → ออกจากคิวสั่งการ

    const lifeSupport = [...new Set(ms.flatMap((m) => m.ls))]
    const worstRisk: RiskLevel = ms.some((m) => m.risk === 'flood')
      ? 'flood'
      : ms.some((m) => m.risk === 'near')
        ? 'near'
        : 'safe'
    const dists = ms.map((m) => m.distM).filter((d): d is number => d !== null)
    const distanceM = dists.length ? Math.min(...dists) : null
    const hasCaregiver = ms.some((m) => (m.caregiverPhone ?? '').trim().length > 0)
    const openRequest = ms.some((m) => openReferral.has(m.id))
    const contacts = ms
      .map((m) => m.lastContactedAt)
      .filter((d): d is Date => d instanceof Date || (d != null && !Number.isNaN(Date.parse(String(d)))))
      .map((d) => (d instanceof Date ? d.getTime() : Date.parse(String(d))))
    const lastContactMs = contacts.length ? Math.max(...contacts) : null
    const hoursSinceContact = lastContactMs ? Math.floor((now - lastContactMs) / 3_600_000) : null

    // factors 0..1
    const fLife =
      lifeSupport.length > 0
        ? Math.max(...lifeSupport.map((c) => LIFE_WEIGHT[c] ?? 0.4))
        : ms.some((m) => m.type === 'bedridden')
          ? 0.4
          : ms.some((m) => m.isChronic)
            ? 0.3
            : ms.some((m) => m.type === 'disabled' || m.type === 'elderly' || m.type === 'pregnant')
              ? 0.2
              : 0.1
    const fProx = worstRisk === 'flood' ? 1 : worstRisk === 'near' ? 0.5 : 0
    const fContact = hoursSinceContact === null ? 0 : Math.min(hoursSinceContact / 48, 1)
    const fNoCare = hasCaregiver ? 0 : 1
    const fReq = openRequest ? 1 : 0
    const score = 0.4 * fLife + 0.3 * fProx + 0.12 * fContact + 0.1 * fNoCare + 0.08 * fReq

    // confidence = สัดส่วน input ที่รู้จริง
    const known = [distanceM !== null, ms.some((m) => m.lifeSupport !== null), lastContactMs !== null]
    const confidence = known.filter(Boolean).length / known.length

    let priority: Priority
    if (confidence < 0.34 && lifeSupport.length === 0 && worstRisk === 'safe') priority = 'unknown'
    else if (score >= 0.6) priority = 'P1'
    else if (score >= 0.35) priority = 'P2'
    else priority = 'P3'

    // suggested team จาก zone (ไม่ใช่ GPS) — zone text contains village/tambon
    const hay = `${ms[0].village ?? ''} ${ms[0].tambon ?? ''}`.trim()
    const suggestedTeam =
      hay.length > 0
        ? teams.find((t) => t.zone && (t.zone.includes(ms[0].village ?? ' ') || t.zone.includes(ms[0].tambon ?? ' '))) ?? null
        : null

    if (lifeSupport.length > 0 && worstRisk === 'flood') lifeSupportNotEvacuated++

    const head = ms.find((m) => m.isHead) ?? ms[0]
    const contactPhone =
      ms.map((m) => m.caregiverPhone).find((x) => (x ?? '').trim()) ??
      ms.map((m) => m.phone).find((x) => (x ?? '').trim()) ??
      null
    queue.push({
      key,
      headMemberId: head.id,
      contactPhone,
      hno: head.hno ?? null,
      villno: head.villno ?? null,
      village: head.village ?? null,
      tambon: head.tambon ?? null,
      amphoe: head.amphoe ?? null,
      memberCount: ms.length,
      members: ms.map((m) => ({
        name: [m.prefix, m.firstName, m.lastName].filter(Boolean).join(' '),
        age: m.age ?? null,
        lifeSupport: m.ls,
        isCaregiver: /ผู้ดูแล|คู่สมรส|ภรรยา|สามี|มารดา|บิดา/.test(m.familyPosition ?? ''),
        phone: m.phone ?? null,
      })),
      risk: worstRisk,
      distanceM,
      lifeSupport,
      hasCaregiver,
      lastContactedAt: lastContactMs ? new Date(lastContactMs).toISOString() : null,
      hoursSinceContact,
      notEvacuated,
      openRequest,
      score: Math.round(score * 100) / 100,
      priority,
      confidence: Math.round(confidence * 100) / 100,
      suggestedTeam: suggestedTeam ? { name: suggestedTeam.name, zone: suggestedTeam.zone } : null,
    })
  }
  queue.sort((a, b) => b.score - a.score)

  // ── 6) ศูนย์พักพิงใกล้เต็ม + health-readiness (scope จังหวัดของเหตุการณ์/สังกัด) ──
  const shelterProvince = incident?.province ?? province ?? null
  const shelters = await db
    .select({
      id: infrastructures.id,
      name: infrastructures.name,
      contact: infrastructures.contact,
      occupancy: infrastructures.occupancy,
      capacity: infrastructures.capacity,
      bedriddenCapacity: infrastructures.bedriddenCapacity,
      oxygenSupport: infrastructures.oxygenSupport,
    })
    .from(infrastructures)
    .where(
      shelterProvince
        ? and(inArray(infrastructures.type, SHELTER_TYPES), eq(infrastructures.province, shelterProvince))
        : inArray(infrastructures.type, SHELTER_TYPES),
    )

  // เตียงติดเตียงที่ใช้จริง ต่อศูนย์ = admissions active ของสมาชิก type='bedridden'
  const bedRows = incident
    ? await db
        .select({ shelterId: shelterAdmissions.shelterId, c: sql<number>`count(*)` })
        .from(shelterAdmissions)
        .innerJoin(householdMembers, eq(shelterAdmissions.memberId, householdMembers.id))
        .where(
          and(
            eq(shelterAdmissions.incidentId, incident.id),
            eq(shelterAdmissions.status, 'admitted'),
            eq(householdMembers.type, 'bedridden'),
          ),
        )
        .groupBy(shelterAdmissions.shelterId)
    : []
  const bedUsed = new Map(bedRows.map((r) => [r.shelterId, num(r.c) ?? 0]))

  const sheltersNearFull: ShelterRow[] = shelters
    .map((s) => {
      const occ = s.occupancy ?? 0
      const cap = s.capacity ?? null
      const pct = cap && cap > 0 ? Math.round((occ / cap) * 100) : 0
      return {
        id: s.id,
        name: s.name,
        contact: s.contact ?? null,
        occupancy: occ,
        capacity: cap,
        pct,
        bedriddenCapacity: s.bedriddenCapacity ?? null,
        bedriddenUsed: bedUsed.get(s.id) ?? 0,
        oxygenSupport: s.oxygenSupport,
      }
    })
    .filter((s) => s.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  return {
    mode,
    incident: incident ? { id: incident.id, name: incident.name, status: incident.status } : null,
    ribbon: {
      total: enriched.length,
      inFlood: inFloodTotal,
      lifeSupport: lifeSupportCount,
      lifeSupportBreak: { oxygen: lsOxygen, dialysis: lsDialysis, other: lsOther },
      pendingReferral,
      inShelter,
      teams: teams.length,
    },
    banner: { lifeSupportNotEvacuated },
    donut: { inFlood, near, inShelter, safe, total: enriched.length },
    groups,
    queue: queue.slice(0, 15),
    sheltersNearFull,
  }
}
