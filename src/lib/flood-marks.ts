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

// แปลงระดับน้ำ (ซม.) เป็นระดับ flood mark 1-5 ให้ตรงกับเกณฑ์ CMU Water Center
export function deriveFloodMarkLevel(waterLevelCm: number): 1 | 2 | 3 | 4 | 5 {
  if (waterLevelCm < 50) return 1
  if (waterLevelCm < 100) return 2
  if (waterLevelCm < 150) return 3
  if (waterLevelCm < 200) return 4
  return 5
}
