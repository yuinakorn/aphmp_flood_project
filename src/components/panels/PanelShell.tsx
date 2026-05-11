'use client'

import { X } from 'lucide-react'

interface Props {
  title: string
  hint?: string
  onClose: () => void
  children: React.ReactNode
}

export function PanelShell({ title, hint, onClose, children }: Props) {
  return (
    <section
      aria-label={title}
      className="flex h-full w-[380px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]"
    >
      <header className="flex items-start gap-4 border-b border-[var(--border)] px-6 pb-5 pt-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[14px] font-semibold leading-none tracking-tight text-[var(--fg)]">
            {title}
          </h2>
          {hint && (
            <span className="text-[10.5px] font-medium uppercase leading-none tracking-[0.1em] text-[var(--fg-subtle)]">
              {hint}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="ปิดแผง"
          onClick={onClose}
          className="ml-auto -mr-1 -mt-1 flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg)]"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}
