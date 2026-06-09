import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { UserRole } from '@/types'

const WRITE_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm', 'shelter_manager', 'rescue'])
const TRIAGE_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'ems', 'ddpm', 'rescue'])
// เปิด/ปิด/จัดการเหตุการณ์ = ผู้บัญชาการเท่านั้น (แคบกว่า triage)
const INCIDENT_MANAGE_ROLES = new Set<UserRole>(['admin', 'eoc', 'ddpm'])
// จัดการทะเบียนเจ้าหน้าที่ (อนุมัติ/whitelist/ระงับ) — ผู้บัญชาการ; non-national scope แค่จังหวัดตัวเอง
const STAFF_MANAGE_ROLES = new Set<UserRole>(['admin', 'eoc', 'ddpm'])

export function canWriteFieldData(role?: UserRole) {
  return !!role && WRITE_ROLES.has(role)
}

export function canTriage(role?: UserRole) {
  return !!role && TRIAGE_ROLES.has(role)
}

export function canManageIncident(role?: UserRole) {
  return !!role && INCIDENT_MANAGE_ROLES.has(role)
}

export function canManageStaff(role?: UserRole) {
  return !!role && STAFF_MANAGE_ROLES.has(role)
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function sessionUserId(session: Session | null) {
  const id = session?.user?.id
  return typeof id === 'string' && isUuid(id) ? id : null
}

// ประกอบชื่อเต็มจาก คำนำหน้า + ชื่อ + นามสกุล (คำนำหน้าติดกับชื่อตามแบบไทย)
export function composeName(
  prefix: string | null | undefined,
  firstName: string,
  lastName: string | null | undefined,
) {
  return `${prefix ?? ''}${firstName}${lastName ? ' ' + lastName : ''}`.trim()
}

export function isUuid(value: unknown): value is string {
  // รับรูปแบบ hex 8-4-4-4-12 ทั่วไป (ตรงกับที่ PostgreSQL uuid รับ) — ไม่บังคับ version/variant
  // แบบ RFC4122 เพราะ seed/mock บางชุดใช้ uuid ที่ไม่ใช่ v4 (เช่น cccccccc-0005-...)
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

export function numberFromDb(value: unknown) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function isoOrNow(value: unknown) {
  if (typeof value !== 'string') return new Date()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

// แสดงเลขบัตรประชาชนแบบ mask: เก็บเฉพาะ 4 หลักท้าย — เพื่อ PDPA
export function maskNationalId(id?: string | null, visible = 4) {
  if (!id) return null
  const digits = id.replace(/\D/g, '')
  if (digits.length < visible) return '•'.repeat(digits.length)
  return '•'.repeat(digits.length - visible) + digits.slice(-visible)
}

export function parseBbox(value: string | null) {
  if (!value) return null
  const parts = value.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [minLng, minLat, maxLng, maxLat] = parts
  return { minLng, minLat, maxLng, maxLat }
}
