/** ดึง client IP จาก proxy headers (x-forwarded-for / x-real-ip) — ใช้ร่วม audit + rate-limit */
export function clientIp(req: Request | { headers: Headers }): string | null {
  const headers = (req as Request).headers
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return headers.get('x-real-ip')
}
