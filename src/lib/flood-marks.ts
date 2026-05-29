const PROVINCE_RE = /จ\.\s*([^\s]+)/u

export function normalizeFloodMarkProvince(rawProvince: string): string {
  const province = rawProvince.trim()

  if (
    province === 'ชม' ||
    province.startsWith('ชม.') ||
    province === 'เชีบงใหม่' ||
    province === 'เชียงใหม่ฃ'
  ) {
    return 'เชียงใหม่'
  }

  if (province === 'ลำพูนฃ') return 'ลำพูน'

  return province
}

export function extractFloodMarkProvince(placeDetail: unknown): string | null {
  if (typeof placeDetail !== 'string') return null
  const match = placeDetail.match(PROVINCE_RE)
  const province = match?.[1]?.trim()
  return province ? normalizeFloodMarkProvince(province) : null
}

// ตัวย่อจังหวัด (8 จังหวัดภาคเหนือในขอบเขตโปรเจกต์) สำหรับสร้างรหัสจุด เช่น CR_00001
// แก้ ลพ/ลป ที่ romanize ชนกัน: ลำพูน=LP, ลำปาง=LG
export const FLOOD_MARK_PROVINCE_ABBR: Record<string, string> = {
  เชียงใหม่: 'CM',
  เชียงราย: 'CR',
  น่าน: 'NN',
  พะเยา: 'PY',
  ลำพูน: 'LP',
  ลำปาง: 'LG',
  แม่ฮ่องสอน: 'MH',
  แพร่: 'PR',
}

// คืนตัวย่อจังหวัดสำหรับ prefix รหัสจุด — null ถ้าไม่ระบุ/อยู่นอกขอบเขต
export function floodMarkProvinceAbbr(rawProvince: unknown): string | null {
  if (typeof rawProvince !== 'string') return null
  const province = normalizeFloodMarkProvince(rawProvince)
  return FLOOD_MARK_PROVINCE_ABBR[province] ?? null
}

// ประกอบรหัสจุดจาก prefix + running number → CR_00001
export function formatFloodMarkCode(abbr: string, runningNo: number): string {
  return `${abbr}_${String(runningNo).padStart(5, '0')}`
}

// แปลงระดับน้ำ (ซม.) เป็นระดับ flood mark 1-5 ให้ตรงกับเกณฑ์ CMU Water Center
export function deriveFloodMarkLevel(waterLevelCm: number): 1 | 2 | 3 | 4 | 5 {
  if (waterLevelCm < 50) return 1
  if (waterLevelCm < 100) return 2
  if (waterLevelCm < 150) return 3
  if (waterLevelCm < 200) return 4
  return 5
}
