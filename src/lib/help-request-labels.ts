import type { HelpRequestType, HelpRequestPriority } from '@/types'

/** ป้ายชื่อประเภทคำร้อง — ใช้ร่วม (ฟอร์มสาธารณะ /report, inbox จนท., EOC) */
export const REQUEST_TYPE_OPTIONS: { value: HelpRequestType; label: string; hint: string }[] = [
  { value: 'evacuation', label: 'อพยพ / ติดอยู่ในบ้าน', hint: 'น้ำท่วมสูง ออกจากบ้านเองไม่ได้' },
  { value: 'medical', label: 'การแพทย์ / ผู้ป่วย', hint: 'เจ็บป่วย ต้องการยา/หมอ/ส่งโรงพยาบาล' },
  { value: 'rescue', label: 'กู้ภัยฉุกเฉิน', hint: 'อันตรายถึงชีวิต ต้องการทีมกู้ภัยด่วน' },
  { value: 'supplies', label: 'อาหาร / น้ำ / ของใช้', hint: 'ขาดแคลนเครื่องอุปโภคบริโภค' },
  { value: 'shelter', label: 'ที่พักพิง', hint: 'ต้องการที่พักชั่วคราว' },
  { value: 'other', label: 'อื่นๆ', hint: 'เรื่องอื่นที่ต้องการความช่วยเหลือ' },
]

export const requestTypeLabel: Record<HelpRequestType, string> = Object.fromEntries(
  REQUEST_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<HelpRequestType, string>

export const priorityLabel: Record<HelpRequestPriority, string> = {
  critical: 'วิกฤต',
  high: 'เร่งด่วน',
  normal: 'ปกติ',
  low: 'เฝ้าระวัง',
}

export const REQUEST_TYPE_SET = new Set<HelpRequestType>(REQUEST_TYPE_OPTIONS.map((o) => o.value))
