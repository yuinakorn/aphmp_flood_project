/**
 * scope-cookie.ts — ค่าคงที่ของ scope cookie (edge-safe, ไม่มี node deps)
 * แยกออกมาเพื่อให้ middleware (Edge Runtime) import ได้โดยไม่ลาก DB/crypto เข้ามา
 *
 * cookie `gx-incident-id` มี 3 สถานะ:
 *   (ไม่มีค่า)  → ยังไม่เลือก scope → gate เด้งไปหน้าเลือก
 *   'normal'   → ทะเบียนปกติทั้งจังหวัด (ใช้ทั้งปี — ไม่ผูกเหตุการณ์)
 *   <uuid>     → เหตุการณ์นั้น (โหมดวิกฤต)
 */
export const INCIDENT_COOKIE = 'gx-incident-id'
export const NORMAL_SCOPE = 'normal'

/** path ของหน้าเลือก scope — middleware ยกเว้นไม่ gate หน้านี้ */
export const SELECT_SCOPE_PATH = '/admin/select-incident'
