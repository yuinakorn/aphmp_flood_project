import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Hospital, Stethoscope, Tent, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { UserRole } from '@/types'
import { isNationalRole } from '@/lib/incident-scope'
import { AddFacilityButton } from '../../infra/AddFacilityModal'
import { ProvinceFilter } from '../../infra/ProvinceFilter'

export const metadata = { title: 'สถานพยาบาล — ตั้งค่า' }
export const dynamic = 'force-dynamic'

interface InfraRow {
  id: string
  name: string
  type: string
  lat: string
  lng: string
  capacity: number | null
  province: string | null
  amphoe: string | null
  tambon: string | null
  contact: string | null
  readinessStatus: string
}

const typeMeta: Record<string, { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; label: string; tone: string }> = {
  hospital: { icon: Hospital, label: 'โรงพยาบาล', tone: 'var(--infra-medical)' },
  clinic: { icon: Stethoscope, label: 'รพ.สต.', tone: 'var(--infra-medical)' },
}

const readinessBadge: Record<string, { label: string; color: string }> = {
  open: { label: 'เปิด', color: 'var(--status-ok)' },
  near_capacity: { label: 'ใกล้เต็ม', color: 'var(--status-warn)' },
  full: { label: 'เต็ม', color: 'var(--status-crit)' },
  closed: { label: 'ปิด', color: 'var(--fg-subtle)' },
  unsafe: { label: 'ไม่ปลอดภัย', color: 'var(--status-crit)' },
}

export default async function SettingsFacilitiesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const cookie = (await cookies()).toString()
  const res = await fetch(`${base}/api/infra?types=hospital,clinic`, {
    cache: 'no-store',
    headers: { cookie },
  })
  const json = await res.json().catch(() => ({ data: [] }))
  const infra: InfraRow[] = json.data ?? []
  const role = (session.user?.role ?? 'viewer') as UserRole
  const national = isNationalRole(role)
  const sp = await searchParams
  const selectedProvince = national ? (sp.province ?? null) : null

  // All unique provinces from data (for filter pills)
  const allProvinces = national
    ? [...new Set(infra.map((i) => i.province ?? 'ไม่ระบุจังหวัด'))].sort()
    : []

  // Filtered data
  const filtered = selectedProvince ? infra.filter((i) => (i.province ?? 'ไม่ระบุจังหวัด') === selectedProvince) : infra

  // Group by province (for national users) or just by type (for province users)
  const provinces = national
    ? [...new Set(filtered.map((i) => i.province ?? 'ไม่ระบุจังหวัด'))].sort()
    : [session.user?.province ?? null]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-[var(--fg-muted)]">
          <span className="font-mono text-[var(--fg)]">{infra.length}</span> แห่ง · โรงพยาบาล / รพ.สต. / หน่วยบริการด่านหน้า
          {!national && session.user?.province && (
            <span className="ml-2 text-[var(--fg-subtle)]">· {session.user.province}</span>
          )}
        </p>
        {(['admin', 'officer', 'eoc', 'ddpm'] as UserRole[]).includes(role) && (
          <AddFacilityButton isNational={national} defaultProvince={session.user?.province ?? null} />
        )}
      </div>

      {national && allProvinces.length > 1 && (
        <div className="mt-5">
          <ProvinceFilter provinces={allProvinces} current={selectedProvince} />
        </div>
      )}

      <Link href="/admin/shelters" className="gx-note mt-4 transition-colors hover:border-[var(--accent)]" style={{ ['--tile' as string]: 'var(--infra-shelter)' }}>
        <Tent size={16} className="mt-0.5 shrink-0 text-[var(--infra-shelter)]" />
        <p className="flex-1 text-sm text-[var(--fg-muted)]">
          <strong className="text-[var(--fg)]">ศูนย์พักพิง / จุดรวมพล</strong> ย้ายไปจัดการที่หน้า &quot;ศูนย์พักพิง&quot; แล้ว — มีระบบรับเข้า/ย้ายออก/ส่งต่อ รพ. รายคนตามโซน
        </p>
        <ArrowUpRight size={16} className="shrink-0 text-[var(--fg-subtle)]" />
      </Link>

      <div className="mt-7 flex flex-col gap-8">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">
              {selectedProvince ? `ไม่พบสถานพยาบาลใน ${selectedProvince}` : 'ยังไม่มีสถานพยาบาลในจังหวัดนี้'}
            </p>
          </div>
        )}

        {provinces.map((province) => {
          const provinceItems = province
            ? filtered.filter((i) => (i.province ?? 'ไม่ระบุจังหวัด') === province)
            : filtered

          if (provinceItems.length === 0) return null

          return (
            <div key={province ?? '__all__'}>
              {national && (
                <h2 className="mb-4 text-base font-semibold text-[var(--fg)]">
                  จ.{province}
                  <span className="ml-2 font-mono text-xs font-normal text-[var(--fg-subtle)]">{provinceItems.length} แห่ง</span>
                </h2>
              )}

              <div className="flex flex-col gap-4">
                {(['hospital', 'clinic'] as const).map((g) => {
                  const list = provinceItems.filter((i) => i.type === g)
                  if (list.length === 0) return null
                  const m = typeMeta[g]
                  const Icon = m.icon
                  return (
                    <section key={g}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
                        <span style={{ color: m.tone }}><Icon size={15} strokeWidth={1.75} /></span>
                        {m.label}
                        <span className="font-mono text-xs font-normal text-[var(--fg-subtle)]">· {list.length}</span>
                      </h3>
                      <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                        {list.map((item) => {
                          const badge = readinessBadge[item.readinessStatus] ?? readinessBadge.open
                          return (
                            <li key={item.id} className="border-b border-[var(--border)] last:border-b-0">
                              <Link
                                href={`/admin/infra/${item.id}`}
                                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--bg-sunken)]"
                                style={{ ['--tile' as string]: m.tone }}
                              >
                                <span className="gx-icon-tile size-10"><Icon size={18} strokeWidth={1.75} /></span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-[var(--fg)]">{item.name}</p>
                                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-subtle)]">
                                    {item.amphoe && (
                                      <span>{item.amphoe}{item.tambon ? ` · ${item.tambon}` : ''}</span>
                                    )}
                                    <span className="font-mono">{Number(item.lat).toFixed(4)}, {Number(item.lng).toFixed(4)}</span>
                                    {item.contact && <span>{item.contact}</span>}
                                  </div>
                                </div>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ color: badge.color, background: `color-mix(in srgb, ${badge.color} 12%, transparent)` }}
                                >
                                  {badge.label}
                                </span>
                                <ChevronRight size={14} className="shrink-0 text-[var(--fg-subtle)]" />
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
