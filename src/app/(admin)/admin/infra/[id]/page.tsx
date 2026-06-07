import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import {
  Hospital,
  Stethoscope,
  MapPin,
  Phone,
  BedDouble,
  Zap,
  Droplets,
  Accessibility,
  Wind,
  ArrowLeft,
  Car,
  Ship,
  Footprints,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const typeMeta: Record<string, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  hospital: { label: 'โรงพยาบาล', icon: Hospital },
  clinic: { label: 'รพ.สต. / คลินิก', icon: Stethoscope },
  temporary_health_post: { label: 'หน่วยบริการด่านหน้า', icon: Stethoscope },
}

const readinessMeta: Record<string, { label: string; color: string }> = {
  open: { label: 'เปิดให้บริการ', color: 'var(--status-ok)' },
  near_capacity: { label: 'ใกล้เต็มความจุ', color: 'var(--status-warn)' },
  full: { label: 'เต็มความจุ', color: 'var(--status-crit)' },
  closed: { label: 'ปิดให้บริการ', color: 'var(--fg-subtle)' },
  unsafe: { label: 'ไม่ปลอดภัย', color: 'var(--status-crit)' },
}

const accessModesMeta: Record<string, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  vehicle: { label: 'รถยนต์', icon: Car },
  boat: { label: 'เรือ', icon: Ship },
  foot: { label: 'เดินเท้า', icon: Footprints },
}

interface InfraDetail {
  id: string
  name: string
  type: string
  lat: string
  lng: string
  capacity: number | null
  occupancy: number
  healthCapacity: number | null
  bedriddenCapacity: number | null
  readinessStatus: string
  province: string | null
  amphoe: string | null
  tambon: string | null
  contact: string | null
  oxygenSupport: boolean
  wheelchairSupport: boolean
  electricitySupport: boolean
  waterSanitationStatus: string | null
  accessModes: string[] | null
  updatedAt: string | null
}

export default async function InfraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const cookie = (await cookies()).toString()
  const res = await fetch(`${base}/api/infra/${id}`, {
    cache: 'no-store',
    headers: { cookie },
  })

  if (!res.ok) notFound()

  const json = await res.json().catch(() => null)
  const item: InfraDetail | null = json?.data ?? null
  if (!item) notFound()

  const m = typeMeta[item.type] ?? typeMeta.clinic
  const Icon = m.icon
  const readiness = readinessMeta[item.readinessStatus] ?? readinessMeta.open
  const accessModes: string[] = Array.isArray(item.accessModes) ? item.accessModes : []

  const locationParts = [item.tambon, item.amphoe, item.province].filter(Boolean)
  const occupancyPct = item.capacity ? Math.round((item.occupancy / item.capacity) * 100) : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/admin/infra"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft size={14} />
          สถานพยาบาล
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <span
          className="gx-icon-tile size-12 shrink-0"
          style={{ ['--tile' as string]: 'var(--infra-medical)' }}
        >
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="gx-eyebrow">{m.label}</p>
          <h1 className="gx-title mt-1">{item.name}</h1>
          {locationParts.length > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--fg-muted)]">
              <MapPin size={13} className="shrink-0" />
              {locationParts.join(' · ')}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ color: readiness.color, background: `color-mix(in srgb, ${readiness.color} 12%, transparent)` }}
        >
          {readiness.label}
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* ข้อมูลที่ตั้ง */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">ที่ตั้ง</h2>
          <dl className="flex flex-col gap-3">
            {item.province && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">จังหวัด</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--fg)]">{item.province}</dd>
              </div>
            )}
            {item.amphoe && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">อำเภอ</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--fg)]">{item.amphoe}</dd>
              </div>
            )}
            {item.tambon && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">ตำบล</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--fg)]">{item.tambon}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--fg-muted)]">พิกัด</dt>
              <dd className="mt-0.5 font-mono text-sm text-[var(--fg)]">
                {Number(item.lat).toFixed(6)}, {Number(item.lng).toFixed(6)}
              </dd>
            </div>
            {item.contact && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">ติดต่อ</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[var(--fg)]">
                  <Phone size={13} className="shrink-0 text-[var(--fg-muted)]" />
                  {item.contact}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* ความจุ */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">ความจุ & การใช้งาน</h2>
          <dl className="flex flex-col gap-3">
            {item.capacity != null && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">ความจุรวม</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--fg)]">{item.capacity.toLocaleString()} คน</dd>
              </div>
            )}
            {item.healthCapacity != null && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">ความจุเตียงสุขภาพ</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[var(--fg)]">
                  <BedDouble size={13} className="shrink-0 text-[var(--fg-muted)]" />
                  {item.healthCapacity.toLocaleString()} เตียง
                </dd>
              </div>
            )}
            {item.bedriddenCapacity != null && (
              <div>
                <dt className="text-xs text-[var(--fg-muted)]">เตียงสำหรับผู้ป่วยติดเตียง</dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--fg)]">{item.bedriddenCapacity.toLocaleString()} เตียง</dd>
              </div>
            )}
            {occupancyPct != null && (
              <div>
                <dt className="mb-1.5 text-xs text-[var(--fg-muted)]">
                  การใช้งาน — {item.occupancy.toLocaleString()} / {item.capacity!.toLocaleString()} คน ({occupancyPct}%)
                </dt>
                <dd>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-sunken)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(occupancyPct, 100)}%`,
                        background: occupancyPct >= 90 ? 'var(--status-crit)' : occupancyPct >= 70 ? 'var(--status-warn)' : 'var(--status-ok)',
                      }}
                    />
                  </div>
                </dd>
              </div>
            )}
            {item.capacity == null && item.healthCapacity == null && (
              <p className="text-sm text-[var(--fg-muted)]">ยังไม่ระบุความจุ</p>
            )}
          </dl>
        </section>

        {/* สิ่งอำนวยความสะดวก */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">สิ่งอำนวยความสะดวก</h2>
          <ul className="flex flex-col gap-2.5">
            <SupportItem
              icon={Wind}
              label="ออกซิเจน"
              active={item.oxygenSupport}
            />
            <SupportItem
              icon={Zap}
              label="ไฟฟ้าสำรอง"
              active={item.electricitySupport}
            />
            <SupportItem
              icon={Accessibility}
              label="รองรับรถเข็น"
              active={item.wheelchairSupport}
            />
            {item.waterSanitationStatus && (
              <li className="flex items-center gap-2 text-sm text-[var(--fg)]">
                <Droplets size={15} className="shrink-0 text-[var(--fg-muted)]" />
                น้ำ/สุขาภิบาล: {item.waterSanitationStatus}
              </li>
            )}
          </ul>
        </section>

        {/* การเข้าถึง */}
        {accessModes.length > 0 && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">การเข้าถึง</h2>
            <ul className="flex flex-wrap gap-2">
              {accessModes.map((mode) => {
                const am = accessModesMeta[mode]
                if (!am) return null
                const ModeIcon = am.icon
                return (
                  <li
                    key={mode}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-1 text-xs font-medium text-[var(--fg)]"
                  >
                    <ModeIcon size={13} className="shrink-0" />
                    {am.label}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {item.updatedAt && (
        <p className="mt-6 text-right text-xs text-[var(--fg-subtle)]">
          อัปเดตล่าสุด:{' '}
          {new Date(item.updatedAt).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}

function SupportItem({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  label: string
  active: boolean
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon
        size={15}
        strokeWidth={1.75}
        className={active ? 'text-[var(--status-ok)]' : 'text-[var(--fg-subtle)]'}
      />
      <span className={active ? 'text-[var(--fg)]' : 'text-[var(--fg-subtle)] line-through'}>
        {label}
      </span>
    </li>
  )
}
