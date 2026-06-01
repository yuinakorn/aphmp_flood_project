'use client'

import { useState } from 'react'
import { LayoutList, BarChart3 } from 'lucide-react'
import { VulnerableTable } from './VulnerableTable'
import { VulnerabilitySummaryTable } from './VulnerabilitySummaryTable'
import type { VulnerablePerson, Incident } from '@/types'

type View = 'summary' | 'detail'

interface Props {
  persons: VulnerablePerson[]
  canEdit: boolean
  activeIncidents: Incident[]
}

export function VulnerableClientView({ persons, canEdit, activeIncidents }: Props) {
  const [view, setView] = useState<View>('summary')

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView('summary')}
          className={`gx-btn gx-btn-sm ${view === 'summary'
            ? 'border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]'
            : 'gx-btn-ghost'
          }`}
        >
          <BarChart3 size={14} strokeWidth={1.75} />
          สรุปตาราง
        </button>
        <button
          type="button"
          onClick={() => setView('detail')}
          className={`gx-btn gx-btn-sm ${view === 'detail'
            ? 'border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_8%,transparent)]'
            : 'gx-btn-ghost'
          }`}
        >
          <LayoutList size={14} strokeWidth={1.75} />
          รายบุคคล
        </button>
      </div>

      {view === 'summary'
        ? <VulnerabilitySummaryTable persons={persons} />
        : <VulnerableTable persons={persons} canEdit={canEdit} activeIncidents={activeIncidents} />
      }
    </div>
  )
}
