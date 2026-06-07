// ตัวเลือกครัวเรือนสำหรับ picker ตอนเพิ่ม/แก้กลุ่มเปราะบาง (จาก GET /api/households)
export interface HouseOpt {
  id: string
  hno: string | null
  villno: string | null
  villageName: string | null
  lat: number | null
  lng: number | null
  memberCount: number
}

export const houseLabel = (h: HouseOpt) =>
  `บ้านเลขที่ ${h.hno ?? '-'}${h.villno ? ` ม.${h.villno}` : ''}${h.villageName ? ` (${h.villageName})` : ''} · ${h.memberCount} คน`
