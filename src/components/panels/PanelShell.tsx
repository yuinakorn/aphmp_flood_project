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
      className="
        fixed inset-x-0 bottom-14 z-[490] flex max-h-[68vh] w-full flex-col overflow-hidden
        rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)]
        shadow-[0_-8px_24px_var(--shadow-elevation)] animate-sheet-up
        md:static md:bottom-auto md:z-auto md:h-full md:max-h-none md:w-[380px] md:shrink-0
        md:rounded-none md:border-0 md:border-r md:shadow-none md:animate-none
      "
    >
      {/* Grab handle — mobile bottom sheet affordance */}
      <div aria-hidden className="flex justify-center pt-2 md:hidden">
        <span className="h-1 w-9 rounded-full bg-[var(--border-strong)]" />
      </div>
      <header className="flex items-start gap-4 border-b border-[var(--border)] px-6 pb-4 pt-3 md:pb-5 md:pt-6">
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
          className="ml-auto -mr-1 -mt-1 flex size-9 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg)] md:size-8"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}
