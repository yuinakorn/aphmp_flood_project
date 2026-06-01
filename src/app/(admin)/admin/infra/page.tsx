import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Hospital, Stethoscope, Plus, Tent, ArrowUpRight } from 'lucide-react'
import type { UserRole } from '@/types'

export const metadata = { title: 'สถานพยาบาล — GIS Health Intelligence' }
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
}

const meta: Record<string, { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; label: string; tone: string }> = {
  hospital: { icon: Hospital, label: 'โรงพยาบาล', tone: 'var(--infra-medical)' },
  clinic: { icon: Stethoscope, label: 'รพ.สต.', tone: 'var(--infra-medical)' },
}

export default async function InfraPage() {
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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gx-eyebrow">ทะเบียน · สถานพยาบาล</p>
          <h1 className="gx-title mt-1.5">สถานพยาบาล</h1>
          <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
            <span className="font-mono text-[var(--fg)]">{infra.length}</span> แห่ง · โรงพยาบาล / รพ.สต. / หน่วยบริการด่านหน้า
            {session.user?.province && (
              <span className="ml-2 text-[var(--fg-subtle)]">· {session.user.province}</span>
            )}
          </p>
        </div>
        {['admin', 'officer', 'eoc', 'ddpm'].includes(role) && (
          <button type="button" className="gx-btn gx-btn-primary">
            <Plus size={16} strokeWidth={2} /> เพิ่มสถานพยาบาล
          </button>
        )}
      </div>

      <Link href="/admin/shelters" className="gx-note mt-4 transition-colors hover:border-[var(--accent)]" style={{ ['--tile' as string]: 'var(--infra-shelter)' }}>
        <Tent size={16} className="mt-0.5 shrink-0 text-[var(--infra-shelter)]" />
        <p className="flex-1 text-sm text-[var(--fg-muted)]">
          <strong className="text-[var(--fg)]">ศูนย์พักพิง / จุดรวมพล</strong> ย้ายไปจัดการที่หน้า "ศูนย์พักพิง" แล้ว — มีระบบรับเข้า/ย้ายออก/ส่งต่อ รพ. รายคนตามโซน
        </p>
        <ArrowUpRight size={16} className="shrink-0 text-[var(--fg-subtle)]" />
      </Link>

      <div className="mt-7 flex flex-col gap-6">
        {(['hospital', 'clinic'] as const).map((g) => {
          const list = infra.filter((i) => i.type === g)
          if (list.length === 0) return null
          const m = meta[g]
          const Icon = m.icon
          return (
            <section key={g}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">
                <span style={{ color: m.tone }}><Icon size={15} strokeWidth={1.75} /></span>
                {m.label}
                <span className="font-mono text-xs font-normal text-[var(--fg-subtle)]">· {list.length}</span>
              </h2>
              <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[var(--bg-sunken)]"
                    style={{ ['--tile' as string]: m.tone }}
                  >
                    <span className="gx-icon-tile size-10"><Icon size={18} strokeWidth={1.75} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--fg)]">{item.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-subtle)]">
                        {item.amphoe && <span>{item.amphoe}{item.tambon ? ` · ${item.tambon}` : ''}</span>}
                        <span className="font-mono">{Number(item.lat).toFixed(4)}, {Number(item.lng).toFixed(4)}</span>
                        {item.contact && <span>{item.contact}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {infra.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-center">
            <p className="text-sm text-[var(--fg-muted)]">ยังไม่มีสถานพยาบาลในจังหวัดนี้</p>
          </div>
        )}
      </div>
    </div>
  )
}
