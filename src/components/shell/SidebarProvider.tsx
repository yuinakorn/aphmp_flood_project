'use client'

import { createContext, useCallback, useContext, useState } from 'react'

export const SIDEBAR_COOKIE = 'gx-sidebar-collapsed'

interface SidebarCtx {
  collapsed: boolean // desktop: หุบเหลือไอคอน
  toggleCollapsed: () => void
  mobileOpen: boolean // mobile: เปิด drawer
  setMobileOpen: (v: boolean) => void
}

// default no-op — ปลอดภัยเมื่อ Masthead ถูกใช้นอก provider (เช่นหน้า /map)
const SidebarContext = createContext<SidebarCtx>({
  collapsed: false,
  toggleCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export function SidebarProvider({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      const next = !v
      document.cookie = `${SIDEBAR_COOKIE}=${next ? '1' : '0'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}
