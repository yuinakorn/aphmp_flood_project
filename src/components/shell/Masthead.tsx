'use client'

import {
  Waves,
  Activity,
  ChevronDown,
  LayoutDashboard,
  FolderHeart,
  Users,
  Building2,
  Droplets,
  AlertTriangle,
  Tent,
  ClipboardList,
  LogOut,
  Menu,
} from 'lucide-react'
import { ROLE_LABEL } from '@/lib/roles'
import type { UserRole } from '@/types'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { IncidentSwitcher } from '@/components/shell/IncidentSwitcher'
import { useIncidentScope } from '@/components/shell/IncidentScopeProvider'
import { useSidebar } from '@/components/shell/SidebarProvider'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface Props {
  session?: { role: string; name: string } | null
}

function UserMenu({ role, name }: { role: string; name: string }) {
  const label = ROLE_LABEL[role as UserRole] ?? role

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[12px] text-white outline-none transition-colors hover:bg-slate-700"
          />
        }
      >
        <span className="hidden font-medium sm:inline">{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border border-[var(--border)] bg-[var(--bg-elevated)] p-1 text-[var(--fg)] shadow-md"
      >
        <div className="px-2.5 py-2">
          <p className="truncate text-[12.5px] font-medium text-[var(--fg)]">{name}</p>
          <p className="text-[11px] text-[var(--fg-subtle)]">{label}</p>
        </div>
        <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />
        <DropdownMenuItem
          onClick={() => { window.location.href = '/api/auth/logout' }}
          className="gap-2 px-2.5 py-2 text-[12.5px] text-[var(--risk-flood)] cursor-pointer focus:text-[var(--risk-flood)]"
        >
          <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
          <span>ออกจากระบบ</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 font-medium text-white shadow-[inset_0_-2px_0_var(--color-risk-safe)]'
          : 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white'
      }
    >
      {children}
    </Link>
  )
}

export function Masthead({ session }: Props) {
  const pathname = usePathname() ?? ''
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
  // หน้า /admin และ /map มี AppSidebar เป็น nav ถาวรแล้ว → ซ่อน nav บน masthead (กันซ้ำ)
  const hasSidebar = pathname.startsWith('/admin') || pathname === '/map'
  const { setMobileOpen } = useSidebar()
  const { active } = useIncidentScope()

  // แถบสีด้านบน navbar = สัญญาณโหมดวิกฤต (แทน banner เต็มแถบเดิม)
  const crisisAccent = active
    ? active.status === 'active'
      ? 'border-t-[3px] border-t-red-600'
      : active.status === 'monitoring'
        ? 'border-t-[3px] border-t-amber-500'
        : 'border-t-[3px] border-t-slate-500'
    : 'border-t-[3px] border-t-cyan-500'

  return (
    <header className={`sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0C1217] px-4 text-white md:gap-6 ${crisisAccent}`}>
      {hasSidebar && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="เปิดเมนู"
          className="grid size-9 shrink-0 place-items-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
      )}
      <Link
        href="/map"
        className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90 md:gap-3"
      >
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_MOPH.svg" alt="ตรากระทรวงสาธารณสุข" className="size-8" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-bold tracking-tight sm:text-[15px]">
            <span className="sm:hidden">สุขภาพระดับหน้าด่าน</span>
            <span className="hidden sm:inline">ระบบภูมิสารสนเทศสุขภาพระดับหน้าด่าน</span>
          </span>
          <span className="hidden text-[10.5px] text-slate-400 sm:block">
            Spatial Health Registry &amp; Disaster Response Dashboard
          </span>
        </span>
      </Link>

      {!hasSidebar && (
      <>
      <span className="hidden h-6 w-px bg-slate-700 lg:block" aria-hidden />

      <nav className="hidden items-center gap-1 text-[13px] lg:flex">
        <NavLink href="/map" active={isActive('/map')}>
          <Waves aria-hidden strokeWidth={1.75} className="size-4" />
          Flood Map
        </NavLink>
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={
                    isActive('/admin')
                      ? 'flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 font-medium text-white shadow-[inset_0_-2px_0_var(--color-risk-safe)] cursor-pointer outline-none'
                      : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer outline-none'
                  }
                />
              }
            >
              <span>ผู้ดูแลระบบ</span>
              <ChevronDown className="size-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 border border-[var(--border)] bg-[var(--bg-elevated)] p-1 text-[var(--fg)] shadow-md">
              <DropdownMenuItem
                render={<Link href="/admin" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <LayoutDashboard className="size-4 shrink-0 opacity-70" />
                <span>แดชบอร์ดผู้ดูแลระบบ</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/eoc" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <Activity className="size-4 shrink-0 opacity-70" />
                <span>ศูนย์บัญชาการ EOC</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 border-t border-[var(--border)]" />

              <DropdownMenuItem
                render={<Link href="/admin/settings/incidents" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <AlertTriangle className="size-4 shrink-0 opacity-70" />
                <span>เหตุการณ์ภัยพิบัติ</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/family-folder" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <FolderHeart className="size-4 shrink-0 opacity-70" />
                <span>Family Folder กลุ่มเปราะบาง</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/vulnerable" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <Users className="size-4 shrink-0 opacity-70" />
                <span>กลุ่มเปราะบาง (แผนที่)</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/shelters" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <Tent className="size-4 shrink-0 opacity-70" />
                <span>ศูนย์พักพิง — รับเข้า/ย้ายออก</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/eoc/roster" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <ClipboardList className="size-4 shrink-0 opacity-70" />
                <span>Roster ผู้พักพิง — รวมทุกศูนย์</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/settings/facilities" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <Building2 className="size-4 shrink-0 opacity-70" />
                <span>สถานพยาบาล</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                render={<Link href="/admin/water-level" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <Droplets className="size-4 shrink-0 opacity-70" />
                <span>ระดับน้ำรายชั่วโมง</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
      </>
      )}

      <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-400 md:gap-4">
        <span className="hidden font-mono uppercase tracking-[0.12em] xl:inline">
          Sentinel-1 · GISTDA
        </span>
        <div className="[&_button]:text-slate-300 [&_button:hover]:bg-slate-800 [&_button:hover]:text-white">
          <ThemeToggle />
        </div>
        {session ? (
          <>
            <IncidentSwitcher />
            <UserMenu role={session.role} name={session.name} />
          </>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3.5 text-[12px] font-medium text-white transition-colors hover:border-[var(--color-risk-safe)] hover:text-[var(--color-risk-safe)]"
          >
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </header>
  )
}
