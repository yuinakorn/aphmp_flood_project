import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Tent, Users, ArrowUpRight, Flag } from 'lucide-react'
import { getDb } from '@/lib/db'
import { infrastructures, shelterAdmissions, shelterZones } from '@/db/schema'
import { getActiveIncident } from '@/lib/incident-scope'
import { CreateShelterButton } from './CreateShelterButton'

export const metadata = { title: 'ศูนย์พักพิง — GIS Health Intelligence' }
export const dynamic = 'force-dynamic'

export default async function SheltersPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user?.role ?? 'viewer'
  const scope = await getActiveIncident(role)

  const db = getDb()
  const shelters = await db
    .select()
    .from(infrastructures)
    .where(inArray(infrastructures.type, ['shelter', 'assembly']))

  const ids = shelters.map((s) => s.id)
  const occWhere = scope
    ? and(inArray(shelterAdmissions.shelterId, ids), eq(shelterAdmissions.incidentId, scope.id))
    : inArray(shelterAdmissions.shelterId, ids)
  const [occ, zc] = await Promise.all([
    ids.length === 0 ? Promise.resolve([]) : db
      .select({
        shelterId: shelterAdmissions.shelterId,
        current: sql<number>`coalesce(sum(case when ${shelterAdmissions.status} = 'admitted' then 1 else 0 end), 0)`,
        total: sql<number>`count(*)`,
      })
      .from(shelterAdmissions)
      .where(occWhere)
      .groupBy(shelterAdmissions.shelterId),
    ids.length === 0 ? Promise.resolve([]) : db
      .select({ shelterId: shelterZones.shelterId, count: sql<number>`count(*)` })
      .from(shelterZones)
      .where(inArray(shelterZones.shelterId, ids))
      .groupBy(shelterZones.shelterId),
  ])

  const occMap = new Map(occ.map((o) => [o.shelterId, { current: Number(o.current), total: Number(o.total) }]))
  const zoneMap = new Map(zc.map((z) => [z.shelterId, Number(z.count)]))

  const totalCurrent = occ.reduce((s, o) => s + Number(o.current), 0)
  const totalCumulative = occ.reduce((s, o) => s + Number(o.total), 0)
  const fullCount = shelters.filter((s) => {
    const o = occMap.get(s.id)
    return s.capacity != null && o && o.current >= s.capacity
  }).length

  const ribbon = [
    { label: 'ศูนย์ทั้งหมด', value: shelters.length, tone: 'var(--fg)' },
    { label: 'มีคนพักอยู่', value: totalCurrent, tone: 'var(--signal-data)' },
    { label: 'รับเข้าสะสม', value: totalCumulative, tone: 'var(--fg)' },
    { label: 'เต็มแล้ว', value: fullCount, tone: fullCount > 0 ? 'var(--risk-flood)' : 'var(--fg)' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">ปฏิบัติการ · ศูนย์พักพิงชั่วคราว</p>
          <h1 className="gx-title mt-1.5 flex items-center gap-2.5">
            <Tent size={26} strokeWidth={1.75} className="text-[var(--infra-shelter)]" />
            ศูนย์พักพิง
          </h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            รับเข้า / ย้ายออก / ส่งต่อ รพ. — ติดตามสถานะผู้พักพิงรายคนต่อโซน
          </p>
          <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
            {scope
              ? <>ตัวเลขผู้พักพิงด้านล่างนับเฉพาะของ <span className="font-medium text-[var(--fg)]">{scope.name}</span></>
              : <>โหมดปกติ — แสดงผู้พักพิงทุกเหตุการณ์ในระบบ (เลือกเหตุการณ์ที่มุมขวาบนเพื่อกรอง)</>}
          </p>
        </div>
        <CreateShelterButton />
      </div>

      {/* Status ribbon */}
      <div className="mt-5 flex flex-wrap items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        {ribbon.map((s, i) => (
          <div key={s.label} className={`flex flex-col px-5 py-3 ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}>
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--fg-subtle)]">{s.label}</span>
            <span className="font-mono text-[26px] font-semibold leading-tight" style={{ color: s.tone }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Shelter cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {shelters.map((s) => {
          const o = occMap.get(s.id) ?? { current: 0, total: 0 }
          const cap = s.capacity ?? 0
          const pct = cap > 0 ? Math.min(100, Math.round((o.current / cap) * 100)) : null
          const isAssembly = s.type === 'assembly'
          const Icon = isAssembly ? Flag : Tent
          const tone = isAssembly ? 'var(--infra-shelter)' : 'var(--infra-shelter)'
          return (
            <Link
              key={s.id}
              href={`/admin/shelters/${s.id}`}
              className="gx-card gx-card-interactive group flex items-start gap-3.5 p-4"
              style={{ ['--tile' as string]: tone }}
            >
              <span className="gx-icon-tile size-11"><Icon size={20} strokeWidth={1.75} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--fg)]">{s.name}</p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">{isAssembly ? 'จุดรวมพล' : 'ศูนย์อพยพ'} · {zoneMap.get(s.id) ?? 0} โซน · cap {cap || '—'}</p>
                  </div>
                  <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-[var(--fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--tile)]" />
                </div>

                {/* Occupancy */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[var(--fg-subtle)]">ผู้พักอยู่ตอนนี้</span>
                    <span className="font-mono">
                      <span className="text-base font-semibold text-[var(--fg)]">{o.current}</span>
                      {cap > 0 && <span className="text-[var(--fg-subtle)]"> / {cap}</span>}
                      {pct != null && <span className="ml-1.5 text-[var(--fg-subtle)]">({pct}%)</span>}
                    </span>
                  </div>
                  {pct != null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? 'var(--risk-flood)' : pct >= 80 ? 'var(--risk-near)' : 'var(--tile)',
                        }}
                      />
                    </div>
                  )}
                </div>

                {(s.oxygenSupport || s.wheelchairSupport || s.electricitySupport) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {s.oxygenSupport && <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">ออกซิเจน</span>}
                    {s.wheelchairSupport && <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">whc</span>}
                    {s.electricitySupport && <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">ไฟฟ้า</span>}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {shelters.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-center">
          <Users size={28} className="mx-auto mb-2 text-[var(--fg-subtle)]" />
          <p className="text-sm text-[var(--fg-muted)]">ยังไม่มีศูนย์พักพิงในระบบ — เพิ่มที่หน้า /admin/infra</p>
        </div>
      )}
    </div>
  )
}
