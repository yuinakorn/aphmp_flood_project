import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Users, Building2, Map, BarChart3, Droplets, ArrowUpRight, FolderHeart, Siren, Tent } from 'lucide-react'

export const metadata = { title: 'Dashboard — GIS Health Intelligence' }

const cards = [
  {
    href: '/admin/eoc',
    icon: Siren,
    title: 'ศูนย์บัญชาการ EOC',
    desc: 'แดชบอร์ดรวม: แผนที่ + ระดับน้ำ + ทะเบียนเปราะบาง + คำร้อง + ทีมกู้ภัย',
    meta: 'live',
    tile: 'var(--risk-flood)',
  },
  {
    href: '/admin/family-folder',
    icon: FolderHeart,
    title: 'Family Folder กลุ่มเปราะบาง',
    desc: 'บ้านที่มีสมาชิกกลุ่มเปราะบาง · สมาชิก + ความสัมพันธ์ในครอบครัว',
    meta: 'ครัวเรือน',
    tile: 'var(--cat-folder)',
  },
  {
    href: '/admin/vulnerable',
    icon: Users,
    title: 'กลุ่มเปราะบาง (แผนที่)',
    desc: 'ทะเบียนผู้ป่วยติดเตียง สูงอายุ พิการ พร้อมพิกัดบนแผนที่',
    meta: 'ทะเบียน',
    tile: 'var(--cat-roster)',
  },
  {
    href: '/admin/shelters',
    icon: Tent,
    title: 'ศูนย์พักพิง — รับเข้า/ย้ายออก',
    desc: 'จัดการผู้พักพิงรายคน · โซน · ส่งต่อ รพ. · ทีมนำส่ง',
    meta: 'ops',
    tile: 'var(--infra-shelter)',
  },
  {
    href: '/admin/settings/facilities',
    icon: Building2,
    title: 'สถานพยาบาล',
    desc: 'ทะเบียน รพ. / รพ.สต. / หน่วยบริการด่านหน้า',
    meta: 'catalog',
    tile: 'var(--cat-infra)',
  },
  {
    href: '/admin/water-level',
    icon: Droplets,
    title: 'ระดับน้ำรายชั่วโมง',
    desc: 'P.67 → P.1 ลุ่มน้ำปิง · กราฟ + ตารางย้อนหลัง 72 ชม.',
    meta: 'live',
    tile: 'var(--cat-water)',
  },
  {
    href: '/map',
    icon: Map,
    title: 'แผนที่ปฏิบัติการ',
    desc: 'หน้าจอแผนที่ real-time สำหรับเฝ้าระวัง',
    meta: 'live',
    tile: 'var(--cat-map)',
  },
  {
    href: '/api/stats',
    icon: BarChart3,
    title: 'API stats',
    desc: 'JSON endpoint สำหรับ dashboard ภายนอก',
    meta: 'json',
    tile: 'var(--cat-api)',
  },
]

export default async function AdminPage() {
  const session = await auth()

  return (
    <div className="mx-auto max-w-5xl">
      <p className="gx-eyebrow">เจ้าหน้าที่ · {session?.user?.role}</p>
      <h1 className="gx-title mt-2 text-[length:var(--text-3xl)] leading-[var(--text-3xl--line-height)]">
        สวัสดี {session?.user?.name}
      </h1>
      <p className="mt-2 text-base text-[var(--fg-muted)]">
        เลือกพื้นที่ที่ต้องการจัดการ
      </p>

      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.href}
              href={c.href}
              style={{ ['--tile' as string]: c.tile }}
              className="gx-card gx-card-interactive group flex items-start gap-4 p-5"
            >
              <span className="gx-icon-tile">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="truncate text-base font-semibold tracking-tight text-[var(--fg)]">
                    {c.title}
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                    {c.meta}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--fg-muted)]">{c.desc}</p>
              </div>
              <ArrowUpRight
                size={18}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-[var(--fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--tile)]"
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
