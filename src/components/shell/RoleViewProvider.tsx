'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type ViewRole = 'vhv' | 'officer' | 'admin'

export const ROLE_LABELS: Record<ViewRole, string> = {
  vhv: 'อสม. (ภาคสนาม)',
  officer: 'รพ.สต. / โรงพยาบาล',
  admin: 'ผู้บัญชาการ EOC',
}

/** map UserRole จริงจาก session → 3 tier ที่ใช้แสดงผล */
function normalizeRole(role: string): ViewRole {
  if (role === 'admin' || role === 'eoc') return 'admin'
  if (role === 'officer' || role === 'ddpm') return 'officer'
  return 'vhv'
}

interface RoleViewState {
  /** บทบาทจริงจาก session (server เป็นผู้ตัดสินสิทธิ์จริงเสมอ) */
  realRole: ViewRole
  /** บทบาทที่กำลัง "ดูในมุมมอง" — มีผลต่อการ render UI เท่านั้น ไม่ใช่สิทธิ์ */
  viewRole: ViewRole
  setViewRole: (role: ViewRole) => void
  isPreview: boolean
}

const RoleViewContext = createContext<RoleViewState | null>(null)

export function RoleViewProvider({
  realRole,
  children,
}: {
  realRole: string
  children: React.ReactNode
}) {
  const real = normalizeRole(realRole)
  const [viewRole, setViewRoleState] = useState<ViewRole>(real)

  useEffect(() => {
    const saved = localStorage.getItem('gx-view-role') as ViewRole | null
    if (saved && saved in ROLE_LABELS) setViewRoleState(saved)
  }, [])

  const setViewRole = (role: ViewRole) => {
    setViewRoleState(role)
    localStorage.setItem('gx-view-role', role)
  }

  return (
    <RoleViewContext.Provider
      value={{ realRole: real, viewRole, setViewRole, isPreview: viewRole !== real }}
    >
      {children}
    </RoleViewContext.Provider>
  )
}

export function useRoleView() {
  const ctx = useContext(RoleViewContext)
  if (!ctx) throw new Error('useRoleView must be used within RoleViewProvider')
  return ctx
}
