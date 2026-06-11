'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** ไอคอน ⓘ ข้างหัวกล่อง — hover แล้วอธิบาย มีไว้ทำไม / หลักการ / วิธีคำนวณ */
export function InfoHint({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="inline-flex cursor-help text-[var(--fg-subtle)] hover:text-[var(--fg)] focus:outline-none"
              aria-label="คำอธิบายกล่องนี้"
            >
              <Info size={12} strokeWidth={2.2} />
            </button>
          }
        />
        <TooltipContent
          className={`${wide ? 'max-w-[420px]' : 'max-w-[320px]'} space-y-1.5 p-3 text-xs leading-relaxed`}
          side="bottom"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** บรรทัดสูตรคณิตศาสตร์ใน tooltip */
export function HintFormula({ children }: { children: ReactNode }) {
  return (
    <p className="rounded bg-black/20 px-2 py-1 font-mono text-[11px] leading-snug dark:bg-white/10">
      {children}
    </p>
  )
}

/** บรรทัดหัวข้อย่อยใน tooltip เช่น "มีไว้ทำไม" */
export function HintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-semibold">{title}</span>
      {' — '}
      {children}
    </p>
  )
}
