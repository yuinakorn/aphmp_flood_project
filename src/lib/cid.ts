/**
 * cid.ts — จัดการเลขประจำตัวประชาชน (CID) 13 หลัก
 *
 * PDPA: เราเก็บเฉพาะ SHA-256 hash ของ CID เจ้าหน้าที่ใน users.cidHash
 * เพื่อ match กับ CID ที่ ThaiD ยืนยันมา — ไม่เก็บเลขดิบ
 */
import { createHash } from 'crypto'

/** เหลือเฉพาะตัวเลข */
export function normalizeCid(raw: string): string {
  return (raw ?? '').replace(/\D/g, '')
}

/** คำนวณเลขตรวจสอบหลักที่ 13 จาก 12 หลักแรก (อัลกอริทึมกรมการปกครอง) */
export function cidCheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i)
  return (11 - (sum % 11)) % 10
}

/** ตรวจสอบความถูกต้องของ CID — 13 หลัก + เลขตรวจสอบถูกต้อง */
export function isValidThaiCid(raw: string): boolean {
  const cid = normalizeCid(raw)
  if (cid.length !== 13) return false
  if (/^0/.test(cid)) return false // หลักแรกไม่เป็น 0
  return cidCheckDigit(cid.slice(0, 12)) === Number(cid[12])
}

/** SHA-256 ของ CID (normalize ก่อน) — ใช้เก็บใน DB และ match กับ ThaiD */
export function hashCid(raw: string): string {
  return createHash('sha256').update(normalizeCid(raw)).digest('hex')
}

/** มาสก์สำหรับแสดงผล: 1-2345-xxxxx-xx-1 (โชว์ 4 หลักแรก + หลักสุดท้าย) */
export function maskCid(raw: string): string {
  const cid = normalizeCid(raw)
  if (cid.length !== 13) return '••••••••••'
  return `${cid[0]}-${cid.slice(1, 5)}-xxxxx-xx-${cid[12]}`
}
