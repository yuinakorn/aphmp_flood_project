import { asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canManageStaff } from '@/lib/field-api'
import { getDb } from '@/lib/db'
import { hazardTypes } from '@/db/schema'
import { isZoneCategory, type HazardTypeDef } from '@/lib/risk-zone'
import type { UserRole } from '@/types'
import { HazardTypesClient } from '../../hazard-types/HazardTypesClient'

export const metadata = { title: 'ชนิดภัย — ตั้งค่า' }

export default async function SettingsHazardTypesPage() {
  const session = await auth()
  const role = (session?.user?.role ?? 'viewer') as UserRole
  if (!canManageStaff(role)) redirect('/admin')

  const rows = await getDb()
    .select()
    .from(hazardTypes)
    .orderBy(asc(hazardTypes.sortOrder), asc(hazardTypes.label))

  const list: HazardTypeDef[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    category: isZoneCategory(r.category) ? r.category : 'temporary',
    color: r.color,
    emoji: r.emoji,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    isSystem: r.isSystem,
  }))

  return <HazardTypesClient items={list} canManage={canManageStaff(role)} />
}
