import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Users, Building2, Map, BarChart3, Droplets, ArrowUpRight, FolderHeart } from 'lucide-react'

export const metadata = { title: 'Dashboard — GIS Health Intelligence' }

const cards = [
  {
    href: '/admin/family-folder',
    icon: FolderHeart,
    title: 'Family Folder กลุ่มเปราะบาง',
    desc: 'บ้านที่มีสมาชิกกลุ่มเปราะบาง · สมาชิก + ความสัมพันธ์ในครอบครัว จาก JHCIS',
    meta: 'jhcis',
  },
  {
    href: '/admin/vulnerable',
    icon: Users,
    title: 'กลุ่มเปราะบาง (แผนที่)',
    desc: 'ทะเบียนผู้ป่วยติดเตียง สูงอายุ พิการ พร้อมพิกัดบนแผนที่',
    meta: 'jhcis',
  },
  {
    href: '/admin/infra',
    icon: Building2,
    title: 'สถานที่สำคัญ',
    desc: 'รพ. รพ.สต. ศูนย์อพยพ จุดรวมพล',
    meta: '7 จุด',
  },
  {
    href: '/admin/water-level',
    icon: Droplets,
    title: 'ระดับน้ำรายชั่วโมง',
    desc: 'P.67 → P.1 ลุ่มน้ำปิง · กราฟ + ตารางย้อนหลัง 72 ชม.',
    meta: 'live',
  },
  {
    href: '/map',
    icon: Map,
    title: 'แผนที่ปฏิบัติการ',
    desc: 'หน้าจอแผนที่ real-time สำหรับเฝ้าระวัง',
    meta: 'live',
  },
  {
    href: '/api/stats',
    icon: BarChart3,
    title: 'API stats',
    desc: 'JSON endpoint สำหรับ dashboard ภายนอก',
    meta: 'json',
  },
]

export default async function AdminPage() {
  const session = await auth()

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
        เจ้าหน้าที่ · {session?.user?.role}
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">
        สวัสดี {session?.user?.name}
      </h1>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        เลือกพื้นที่ที่ต้องการจัดการ
      </p>

      <ul className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <li key={c.href}>
              <Link
                href={c.href}
                className="group flex items-center gap-5 py-5 transition-colors hover:bg-[var(--bg-elevated)]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--accent)] transition-colors group-hover:border-[var(--accent)]">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-[15px] font-medium tracking-tight">
                      {c.title}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
                      {c.meta}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-[var(--fg-muted)]">
                    {c.desc}
                  </p>
                </div>
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.75}
                  className="text-[var(--fg-subtle)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent)]"
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
