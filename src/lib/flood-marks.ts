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
