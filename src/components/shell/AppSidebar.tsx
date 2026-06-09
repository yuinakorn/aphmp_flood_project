'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Siren,
  Map,
  Users,
  FolderHeart,
  Tent,
  Hospital,
  Droplets,
  Inbox,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
  LifeBuoy,
} from 'lucide-react'
import { useSidebar } from '@/components/shell/SidebarProvider'

type Item = { href: string; icon: typeof LayoutDashboard; label: string; badge?: number }
type Section = { label: string | null; items: Item[] }

function buildSections(canManageStaff: boolean, canTriage: boolean, pendingReports: number): Section[] {
  const systemItems: Item[] = [
    { href: '/admin/water-level', icon: Droplets, label: 'ระดับน้ำ' },
  ]
  const topItems: Item[] = [
    { href: '/admin/eoc', icon: Siren, label: 'ศูนย์บัญชาการ EOC' },
    { href: '/map', icon: Map, label: 'แผนที่ปฏิบัติการ' },
  ]
  if (canManageStaff || canTriage) {
    systemItems.push({ href: '/admin/settings', icon: Settings, label: 'ตั้งค่า' })
  }
  const opsItems: Item[] = [
    { href: '/admin/rescue-missions', icon: LifeBuoy, label: 'ปฏิบัติการกู้ภัย' },
  ]
  if (canTriage) {
    opsItems.push({ href: '/admin/help-reports', icon: Inbox, label: 'รับแจ้งเหตุประชาชน', badge: pendingReports })
  }
  opsItems.push(
    { href: '/admin/vulnerable', icon: Users, label: 'กลุ่มเปราะบาง' },
    { href: '/admin/family-folder', icon: FolderHeart, label: 'Family Folder' },
    { href: '/admin/shelters', icon: Tent, label: 'ศูนย์พักพิง' },
  )
  if (canTriage) {
    opsItems.push({ href: '/admin/referrals', icon: Hospital, label: 'ส่งต่อโรงพยาบาล' })
  }
  return [
    {
      label: null,
      items: topItems,
    },
    {
      label: 'การปฏิบัติการ',
      items: opsItems,
    },
    {
      label: 'ข้อมูล & ระบบ',
      items: systemItems,
    },
  ]
}

function useIsActive() {
  const pathname = usePathname() ?? ''
  return (href: string) =>
    href === '/map'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')
}

/** รายการเมนู (ใช้ทั้ง desktop และ drawer) */
function NavList({ sections, showLabels, onNavigate }: { sections: Section[]; showLabels: boolean; onNavigate?: () => void }) {
  const isActive = useIsActive()
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3 lg:px-3">
      {sections.map((sec, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {sec.label && showLabels ? (
            <p className="px-2.5 pb-1 pt-4 text-[11.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {sec.label}
            </p>
          ) : i > 0 ? (
            <div className="mx-2 my-1.5 border-t border-slate-800" />
          ) : null}
          {sec.items.map((it) => {
            const Icon = it.icon
            const on = isActive(it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                title={showLabels ? undefined : it.label}
                className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-[14.5px] transition-colors ${
                  showLabels ? 'justify-start' : 'justify-center'
                } ${on ? 'bg-slate-800 font-semibold text-white' : 'font-medium text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <span className="relative shrink-0">
                  <Icon
                    className={`size-[18px] ${on ? 'text-[var(--color-risk-safe)]' : ''}`}
                    strokeWidth={1.75}
                  />
                  {!showLabels && it.badge ? (
                    <span className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-[#0C1217]" />
                  ) : null}
                </span>
                {showLabels && <span className="truncate">{it.label}</span>}
                {showLabels && it.badge ? (
                  <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function AppSidebar({ canManageStaff = false, canTriage = false, pendingReports = 0 }: { canManageStaff?: boolean; canTriage?: boolean; pendingReports?: number }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const pathname = usePathname()
  const sections = buildSections(canManageStaff, canTriage, pendingReports)

  // ปิด drawer อัตโนมัติเมื่อเปลี่ยนหน้า
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  return (
    <>
      {/* ───── Desktop sidebar (md+) ───── */}
      <aside
        className={`sticky top-16 z-20 hidden h-[calc(100dvh_-_4rem)] shrink-0 self-start flex-col border-r border-slate-800 bg-[#0C1217] text-slate-300 transition-[width] duration-200 md:flex ${
          collapsed ? 'w-16' : 'w-[232px]'
        }`}
      >
        <NavList sections={sections} showLabels={!collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'กางเมนู' : 'หุบเมนู'}
          className={`flex shrink-0 items-center gap-2.5 border-t border-slate-800 px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white ${
            collapsed ? 'justify-center' : 'justify-start'
          }`}
        >
          {collapsed ? (
            <ChevronsRight className="size-[18px] shrink-0" strokeWidth={1.75} />
          ) : (
            <>
              <ChevronsLeft className="size-[18px] shrink-0" strokeWidth={1.75} />
              <span>หุบเมนู</span>
            </>
          )}
        </button>
      </aside>

      {/* ───── Mobile drawer (<md) ───── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[1100] md:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-[264px] flex-col border-r border-slate-800 bg-[#0C1217] text-slate-300 shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <span className="text-sm font-semibold text-white">เมนู</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="ปิดเมนู"
                className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <NavList sections={sections} showLabels onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
