import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { UserRole } from '@/types'

const WRITE_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm', 'shelter_manager'])
const TRIAGE_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'ems', 'ddpm'])

export function canWriteFieldData(role?: UserRole) {
  return !!role && WRITE_ROLES.has(role)
}

export function canTriage(role?: UserRole) {
  return !!role && TRIAGE_ROLES.has(role)
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
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
export function maskNationalId(id?: string | null) {
  if (!id) return null
  const digits = id.replace(/\D/g, '')
  if (digits.length < 4) return '•'.repeat(digits.length)
  return '•'.repeat(digits.length - 4) + digits.slice(-4)
}

export function parseBbox(value: string | null) {
  if (!value) return null
  const parts = value.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [minLng, minLat, maxLng, maxLat] = parts
  return { minLng, minLat, maxLng, maxLat }
}
