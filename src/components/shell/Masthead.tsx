import { Waves } from 'lucide-react'
import Link from 'next/link'

interface Props {
  session?: { role: string; name: string } | null
}

export function Masthead({ session }: Props) {
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
        <Link
          href="/map"
          className="rounded-md px-3 py-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
        >
          แผนที่
        </Link>
        {session && (
          <>
            <Link
              href="/admin/vulnerable"
              className="rounded-md px-3 py-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
            >
              เปราะบาง
            </Link>
            <Link
              href="/admin/infra"
              className="rounded-md px-3 py-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
            >
              สถานที่
            </Link>
          </>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-5 text-[11px] text-[var(--fg-subtle)]">
        <span className="hidden font-mono uppercase tracking-[0.12em] lg:inline">
          Sentinel-1 · GISTDA
        </span>
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
