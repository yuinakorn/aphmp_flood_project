import type { UserRole } from '@/types'

/**
 * menus.ts — แหล่งความจริงเดียวของ "เมนูในระบบ" + สิทธิ์การเห็นเริ่มต้นต่อ role
 * ใช้ร่วมกัน: AppSidebar (render), หน้าตั้งค่า /admin/settings/menus, route guard, seed default
 *
 * การตัดสินสิทธิ์เห็นเมนู = default (ที่นี่) + override จากตาราง menu_role_access
 * หมายเหตุ: นี่คุม "การเห็นเมนู + เข้าหน้า" — สิทธิ์ระดับ API ยังบังคับที่ lib/field-api.ts เสมอ
 */

export type MenuSection = 'top' | 'ops' | 'system'

export interface MenuItem {
  key: string
  href: string
  label: string
  section: MenuSection
}

export const MENU_SECTION_LABEL: Record<MenuSection, string | null> = {
  top: null,
  ops: 'การปฏิบัติการ',
  system: 'ข้อมูล & ระบบ',
}

export const MENU_ITEMS: readonly MenuItem[] = [
  { key: 'map', href: '/map', label: 'แผนที่ปฏิบัติการ', section: 'top' },
  { key: 'eoc', href: '/admin/eoc', label: 'ศูนย์บัญชาการ EOC', section: 'top' },
  { key: 'rescue-missions', href: '/admin/rescue-missions', label: 'ปฏิบัติการกู้ภัย', section: 'ops' },
  { key: 'help-reports', href: '/admin/help-reports', label: 'รับแจ้งเหตุประชาชน', section: 'ops' },
  { key: 'vulnerable', href: '/admin/vulnerable', label: 'กลุ่มเปราะบาง', section: 'ops' },
  { key: 'family-folder', href: '/admin/family-folder', label: 'Family Folder', section: 'ops' },
  { key: 'shelters', href: '/admin/shelters', label: 'ศูนย์พักพิง', section: 'ops' },
  { key: 'referrals', href: '/admin/referrals', label: 'ส่งต่อโรงพยาบาล', section: 'ops' },
  { key: 'water-level', href: '/admin/water-level', label: 'ระดับน้ำ', section: 'system' },
  { key: 'settings', href: '/admin/settings', label: 'ตั้งค่า', section: 'system' },
] as const

export const MENU_KEYS = MENU_ITEMS.map((m) => m.key)

/** เมนูที่ไม่ให้ปิดได้สำหรับผู้ดูแล (กันล็อกตัวเองออกจากหน้าตั้งค่า) */
export const ALWAYS_ON_FOR_MANAGERS: ReadonlySet<string> = new Set(['settings'])

// roles ที่ default เห็นเมนู "เฉพาะทางบัญชาการ/triage" (ตรงกับพฤติกรรมเดิม canTriage)
const TRIAGE_ROLES: readonly UserRole[] = ['admin', 'officer', 'eoc', 'ems', 'ddpm', 'rescue']

/** เมนูที่ default เห็นเฉพาะ triage roles; ที่เหลือ default เห็นทุก role */
const TRIAGE_ONLY_MENUS: ReadonlySet<string> = new Set(['help-reports', 'referrals', 'settings'])

/** ค่า default ว่า role นี้เห็น menuKey นี้ไหม (ตรงกับ logic เดิมใน AppSidebar) */
export function defaultMenuVisible(role: UserRole, menuKey: string): boolean {
  if (TRIAGE_ONLY_MENUS.has(menuKey)) return TRIAGE_ROLES.includes(role)
  return true
}

/** หา MenuItem จาก pathname (สำหรับ route guard) — คืน item ที่ href ตรง/เป็น prefix */
export function menuItemForPath(pathname: string): MenuItem | null {
  // เรียงจาก href ยาวสุดก่อน เพื่อให้ /admin/settings ชนะ /admin
  const sorted = [...MENU_ITEMS].sort((a, b) => b.href.length - a.href.length)
  for (const m of sorted) {
    if (pathname === m.href || pathname.startsWith(m.href + '/')) return m
  }
  return null
}
