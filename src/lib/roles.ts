import type { UserRole } from '@/types'

/** ป้ายชื่อบทบาท (แหล่งความจริงเดียว ใช้ทั้งทะเบียน/ฟอร์มขอสิทธิ์) */
export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  ddpm: 'ปภ. (ระดับชาติ)',
  eoc: 'ผู้บัญชาการ EOC',
  officer: 'เจ้าหน้าที่ รพ.สต. / โรงพยาบาล',
  vhv: 'อสม. (ภาคสนาม)',
  ems: 'กู้ชีพ EMS',
  rescue: 'กู้ภัย',
  shelter_manager: 'ผู้จัดการศูนย์พักพิง',
  viewer: 'ผู้ดู (อ่านอย่างเดียว)',
}

/**
 * บทบาทที่ผู้ใช้ "ขอเอง" ได้ตอนลงทะเบียน/ขอสิทธิ์
 * — ตัด admin / ddpm (ระดับชาติ) ออก เพราะต้องให้ผู้ดูแลระดับชาติเป็นผู้กำหนดเท่านั้น
 */
export const REQUESTABLE_ROLES: readonly UserRole[] = [
  'officer',
  'eoc',
  'vhv',
  'ems',
  'rescue',
  'shelter_manager',
  'viewer',
]

export function isRequestableRole(role: string): role is UserRole {
  return (REQUESTABLE_ROLES as readonly string[]).includes(role)
}
