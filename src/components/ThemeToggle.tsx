'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    // Avoid hydration mismatch — render a placeholder with the same dimensions
    return <div className="size-8" />
  }

  const isDark = theme === 'dark'

  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={isDark ? 'เปลี่ยนเป็นโหมดกลางวัน' : 'เปลี่ยนเป็นโหมดกลางคืน'}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="inline-flex size-8 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors duration-150 ease-quart hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)]"
            >
              {isDark ? (
                <Sun size={16} strokeWidth={1.75} />
              ) : (
                <Moon size={16} strokeWidth={1.75} />
              )}
            </button>
          }
        />
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          {isDark ? 'โหมดกลางวัน' : 'โหมดกลางคืน'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
