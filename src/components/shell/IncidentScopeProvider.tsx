'use client'

import { createContext, useContext, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Incident } from '@/types'

interface IncidentScopeState {
  /** เหตุการณ์ที่กำลังจัดการ — null = โหมดปกติ (ไม่ผูก incident) */
  active: Incident | null
  /** รายชื่อเหตุการณ์ที่ user เลือกได้ (filter ตาม role ฝั่ง server มาแล้ว) */
  selectable: Incident[]
  /** isSwitching = กำลังโทร API เปลี่ยน scope */
  isSwitching: boolean
  setScope: (incidentId: string | null) => Promise<void>
}

const Ctx = createContext<IncidentScopeState | null>(null)

export function IncidentScopeProvider({
  active: initialActive,
  selectable,
  children,
}: {
  active: Incident | null
  selectable: Incident[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const [active, setActive] = useState<Incident | null>(initialActive)
  const [pending, startTransition] = useTransition()

  async function setScope(incidentId: string | null) {
    const res = await fetch('/api/incident-scope', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ incidentId }),
    })
    if (!res.ok) return
    const next = incidentId ? selectable.find((i) => i.id === incidentId) ?? null : null
    setActive(next)
    startTransition(() => router.refresh())
  }

  return (
    <Ctx.Provider value={{ active, selectable, isSwitching: pending, setScope }}>
      {children}
    </Ctx.Provider>
  )
}

export function useIncidentScope() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useIncidentScope must be used within IncidentScopeProvider')
  return ctx
}
