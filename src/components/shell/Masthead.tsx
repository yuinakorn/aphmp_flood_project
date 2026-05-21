'use client'

import {
  Waves,
  ChevronDown,
  LayoutDashboard,
  FolderHeart,
  Users,
  Building2,
  Droplets,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
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
          ? 'rounded-md bg-[var(--bg-elevated)] px-3 py-1.5 font-medium text-[var(--fg)] shadow-[inset_0_-1px_0_var(--accent)]'
          : 'rounded-md px-3 py-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]'
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

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-[var(--border)] bg-[var(--bg)] px-6">
      <Link
        href="/map"
        className="flex items-center gap-3 transition-opacity hover:opacity-80"
      >
        <Waves
          aria-hidden
          strokeWidth={1.5}
          className="size-5 text-[var(--accent)]"
        />
        <span className="text-[14px] font-semibold tracking-tight">
          FloodWatch
        </span>
      </Link>

      <span className="h-5 w-px bg-[var(--border)]" aria-hidden />

      <nav className="flex items-center gap-1 text-[12.5px]">
        <NavLink href="/map" active={isActive('/map')}>แผนที่</NavLink>
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={
                    isActive('/admin')
                      ? 'flex items-center gap-1.5 rounded-md bg-[var(--bg-elevated)] px-3 py-1.5 font-medium text-[var(--fg)] shadow-[inset_0_-1px_0_var(--accent)] cursor-pointer outline-none'
                      : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)] cursor-pointer outline-none'
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
              
              <DropdownMenuSeparator className="my-1 border-t border-[var(--border)]" />
              
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
                render={<Link href="/admin/infra" />}
                className="gap-2 px-2.5 py-2 text-[12.5px] cursor-pointer"
              >
                <Building2 className="size-4 shrink-0 opacity-70" />
                <span>สถานที่สำคัญ</span>
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

      <div className="ml-auto flex items-center gap-4 text-[11px] text-[var(--fg-subtle)]">
        <span className="hidden font-mono uppercase tracking-[0.12em] lg:inline">
          Sentinel-1 · GISTDA
        </span>
        <ThemeToggle />
        {session ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--accent)]">
              {session.role}
            </span>
            <span className="text-[12.5px] text-[var(--fg-muted)]">
              {session.name}
            </span>
          </div>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-[12px] font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </header>
  )
}
