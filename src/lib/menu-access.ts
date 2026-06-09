import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { menuRoleAccess } from '@/db/schema'
import { MENU_ITEMS, MENU_KEYS, ALWAYS_ON_FOR_MANAGERS, defaultMenuVisible } from '@/lib/menus'
import { canManageStaff } from '@/lib/field-api'
import type { UserRole } from '@/types'

/** โหลด override ทั้งหมดเป็น map "role:menuKey" → visible */
async function loadOverrides(): Promise<Map<string, boolean>> {
  const db = getDb()
  const rows = await db.select().from(menuRoleAccess)
  const map = new Map<string, boolean>()
  for (const r of rows) map.set(`${r.role}:${r.menuKey}`, r.visible)
  return map
}

/** effective visibility = override ?? default; ผู้ดูแลเห็นเมนู ALWAYS_ON_FOR_MANAGERS เสมอ */
function effectiveVisible(
  role: UserRole,
  menuKey: string,
  overrides: Map<string, boolean>,
): boolean {
  if (canManageStaff(role) && ALWAYS_ON_FOR_MANAGERS.has(menuKey)) return true
  const ov = overrides.get(`${role}:${menuKey}`)
  return ov ?? defaultMenuVisible(role, menuKey)
}

/** เซ็ตคีย์เมนูที่ role นี้เห็นได้ — ใช้ render sidebar + route guard */
export async function getVisibleMenuKeys(role: UserRole): Promise<Set<string>> {
  const overrides = await loadOverrides()
  return new Set(MENU_KEYS.filter((key) => effectiveVisible(role, key, overrides)))
}

export interface MenuAccessMatrix {
  roles: UserRole[]
  /** matrix[role][menuKey] = visible */
  matrix: Record<string, Record<string, boolean>>
  /** ช่องที่ปิดไม่ได้ (ALWAYS_ON_FOR_MANAGERS สำหรับผู้ดูแล) */
  locked: Record<string, Record<string, boolean>>
}

/** matrix สำหรับหน้าตั้งค่า (ทุก role × ทุกเมนู) */
export async function getMenuAccessMatrix(roles: UserRole[]): Promise<MenuAccessMatrix> {
  const overrides = await loadOverrides()
  const matrix: Record<string, Record<string, boolean>> = {}
  const locked: Record<string, Record<string, boolean>> = {}
  for (const role of roles) {
    matrix[role] = {}
    locked[role] = {}
    for (const m of MENU_ITEMS) {
      matrix[role][m.key] = effectiveVisible(role, m.key, overrides)
      locked[role][m.key] = canManageStaff(role) && ALWAYS_ON_FOR_MANAGERS.has(m.key)
    }
  }
  return { roles, matrix, locked }
}

/**
 * ตั้งค่า override ของ (role, menuKey)
 * ถ้าค่าตรงกับ default → ลบ override ทิ้ง (เก็บตารางให้สะอาด); ไม่งั้น upsert
 */
export async function setMenuAccess(role: UserRole, menuKey: string, visible: boolean): Promise<void> {
  const db = getDb()
  if (visible === defaultMenuVisible(role, menuKey)) {
    await db
      .delete(menuRoleAccess)
      .where(and(eq(menuRoleAccess.role, role), eq(menuRoleAccess.menuKey, menuKey)))
    return
  }
  await db
    .insert(menuRoleAccess)
    .values({ role, menuKey, visible })
    .onConflictDoUpdate({
      target: [menuRoleAccess.role, menuRoleAccess.menuKey],
      set: { visible },
    })
}
