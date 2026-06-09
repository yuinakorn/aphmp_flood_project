import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { badRequest, canManageStaff, forbidden, unauthorized } from '@/lib/field-api'
import { setMenuAccess } from '@/lib/menu-access'
import { MENU_KEYS, ALWAYS_ON_FOR_MANAGERS } from '@/lib/menus'
import { audit } from '@/lib/audit'
import type { UserRole } from '@/types'

const VALID_ROLES = new Set<UserRole>([
  'admin', 'officer', 'viewer', 'eoc', 'vhv', 'ems', 'rescue', 'ddpm', 'shelter_manager',
])

// PATCH /api/settings/menu-access — ตั้งค่าการเห็นเมนูของ (role, menuKey)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const role = body.role as UserRole
  const menuKey = String(body.menuKey ?? '')
  const visible = body.visible

  if (!VALID_ROLES.has(role)) return badRequest('Invalid role')
  if (!MENU_KEYS.includes(menuKey)) return badRequest('Invalid menuKey')
  if (typeof visible !== 'boolean') return badRequest('visible must be boolean')

  // กันปิดเมนูที่ผู้ดูแลต้องเห็นเสมอ (เช่น ตั้งค่า) สำหรับ role ระดับผู้ดูแล
  if (!visible && canManageStaff(role) && ALWAYS_ON_FOR_MANAGERS.has(menuKey)) {
    return badRequest('เมนูนี้ปิดสำหรับผู้ดูแลไม่ได้')
  }

  await setMenuAccess(role, menuKey, visible)

  void audit(req, session, {
    action: 'update_menu_access',
    entity: 'menu_role_access',
    metadata: { role, menuKey, visible },
  })

  return NextResponse.json({ ok: true })
}
