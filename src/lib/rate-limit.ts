/**
 * rate-limit.ts — in-memory sliding-window limiter (ด่านแรก กัน burst)
 *
 * เก็บ timestamp ต่อ key ใน process memory — เร็ว ไม่แตะ DB
 * ข้อจำกัด: ไม่ข้าม instance/รีเซ็ตเมื่อ redeploy → ใช้คู่กับ durable check (นับจาก DB) เสมอ
 * survive HMR ใน dev ด้วย globalThis
 */
type Store = Map<string, number[]>

const g = globalThis as unknown as { __rateLimitStore?: Store }
const store: Store = g.__rateLimitStore ?? (g.__rateLimitStore = new Map())

let lastSweep = 0

export interface RateLimitResult {
  ok: boolean
  retryAfterSec: number
  remaining: number
}

/**
 * @param key      ตัวระบุผู้ใช้ (เช่น `ip:1.2.3.4`)
 * @param limit    จำนวนครั้งสูงสุดในหน้าต่างเวลา
 * @param windowMs ความยาวหน้าต่างเวลา (ms)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs

  // กวาด key เก่าทิ้งเป็นระยะ กัน memory โต (อย่างน้อยทุก 5 นาที)
  if (now - lastSweep > 5 * 60_000) {
    lastSweep = now
    for (const [k, arr] of store) {
      const kept = arr.filter((t) => t > now - windowMs)
      if (kept.length === 0) store.delete(k)
      else store.set(k, kept)
    }
  }

  const hits = (store.get(key) ?? []).filter((t) => t > cutoff)

  if (hits.length >= limit) {
    const oldest = hits[0]
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    store.set(key, hits)
    return { ok: false, retryAfterSec, remaining: 0 }
  }

  hits.push(now)
  store.set(key, hits)
  return { ok: true, retryAfterSec: 0, remaining: limit - hits.length }
}
