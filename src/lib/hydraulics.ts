// ─────────────────────────────────────────────────────────────────────────────
// hydraulics.ts — pure-TS hydraulics engine for the water-level simulation
//
// ฟิสิกส์ที่ใช้ (ทั้งหมดขับเคลื่อนจากข้อมูลจริงใน water_level_observation):
//   1. Rating curve  Q = a·(h − h0)^b   — fit จากคู่ (level, discharge) ของสถานีเอง
//   2. Cross-correlation lag             — เวลาเดินทางจริง S1→S2 จาก first-differenced series
//   3. Manning / kinematic wave          — ความเร็วน้ำ + celerity จาก Q และหน้าตัดช่องน้ำ
//   4. Muskingum routing                 — route hydrograph ต้นน้ำ → พยากรณ์ปลายน้ำ
//
// ทุกฟังก์ชัน null-safe และคืน null เมื่อข้อมูลไม่พอ (degradation Tier A → B → C)
// ─────────────────────────────────────────────────────────────────────────────

// ── Rating curve ─────────────────────────────────────────────────────────────

export type RatingCurve = {
  a: number
  b: number
  h0: number   // gauge height of zero flow (เมตร ตามศูนย์เสาวัดสถานีนั้น)
  r2: number
  n: number    // จำนวนคู่ข้อมูลที่ใช้ fit
  hMin: number // ช่วง level ที่มีข้อมูลจริง — นอกช่วงนี้คือ extrapolation
  hMax: number
}

/**
 * Fit Q = a·(h−h0)^b ด้วย log-linear least squares + grid search h0
 * Guards: ≥12 คู่, ช่วง level ≥ 0.3 m, R² ≥ 0.85, b ∈ [1,4] — ไม่ผ่านคืน null
 * (หน้าต่าง 72 ชม. ที่ระดับน้ำนิ่งจะ fit ไม่ได้ — เจตนา ไม่โชว์ curve เสีย)
 */
export function fitRatingCurve(pairs: { h: number; q: number }[]): RatingCurve | null {
  const valid = pairs.filter(
    (p) => Number.isFinite(p.h) && Number.isFinite(p.q) && p.q > 0,
  )
  if (valid.length < 12) return null

  let hMin = Infinity
  let hMax = -Infinity
  for (const p of valid) {
    if (p.h < hMin) hMin = p.h
    if (p.h > hMax) hMax = p.h
  }
  if (hMax - hMin < 0.3) return null

  let best: RatingCurve | null = null
  for (let h0 = hMin - 2.0; h0 <= hMin - 0.05 + 1e-9; h0 += 0.05) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0
    const n = valid.length
    for (const p of valid) {
      const x = Math.log(p.h - h0)
      const y = Math.log(p.q)
      sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y
    }
    const denom = n * sxx - sx * sx
    if (Math.abs(denom) < 1e-12) continue
    const b = (n * sxy - sx * sy) / denom
    if (b < 1.0 || b > 4.0) continue
    const lna = (sy - b * sx) / n
    const ssTot = syy - (sy * sy) / n
    const ssReg = b * (sxy - (sx * sy) / n)
    const r2 = ssTot > 1e-12 ? ssReg / ssTot : 0
    if (!best || r2 > best.r2) {
      best = { a: Math.exp(lna), b, h0, r2, n, hMin, hMax }
    }
  }
  if (!best || best.r2 < 0.85) return null
  return best
}

export function ratingQ(rc: RatingCurve, h: number): number {
  if (h <= rc.h0) return 0
  return rc.a * Math.pow(h - rc.h0, rc.b)
}

export function ratingH(rc: RatingCurve, q: number): number {
  if (q <= 0) return rc.h0
  return rc.h0 + Math.pow(q / rc.a, 1 / rc.b)
}

/** level นอกช่วงข้อมูลที่ fit (extrapolation — ความไม่แน่นอนสูงขึ้น ใช้ flag ใน UI) */
export function ratingOutOfRange(rc: RatingCurve, h: number): boolean {
  return h < rc.hMin - 0.5 || h > rc.hMax + 1.0
}

// ── Cross-correlation lag ────────────────────────────────────────────────────

export type LagEstimate = {
  lagHours: number      // เวลาเดินทาง S1→S2 ที่ correlation สูงสุด
  correlation: number   // peak Pearson r ของ first-differenced series
  attenuation: number   // regression slope: การเปลี่ยนแปลงปลายน้ำต่อ 1 m ต้นน้ำ
}

/**
 * ประมาณ lag จาก first-differenced series (ห้ามใช้ raw level — trend ครอบงำ
 * จะได้ lag≈0) แล้ว refine จุด peak ด้วย parabolic interpolation
 * เพราะข้อมูลรายชั่วโมงหยาบเทียบ lag สั้น ๆ อย่างแม่สาย (1–2 ชม.)
 */
export function estimateLag(
  s1: (number | null)[],
  s2: (number | null)[],
  maxLagHours = 12,
): LagEstimate | null {
  const n = Math.min(s1.length, s2.length)
  if (n < 24) return null

  const d1: (number | null)[] = []
  const d2: (number | null)[] = []
  for (let i = 1; i < n; i++) {
    d1.push(s1[i] != null && s1[i - 1] != null ? s1[i]! - s1[i - 1]! : null)
    d2.push(s2[i] != null && s2[i - 1] != null ? s2[i]! - s2[i - 1]! : null)
  }

  const std = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x != null)
    if (v.length < 8) return 0
    const m = v.reduce((a, b) => a + b, 0) / v.length
    return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length)
  }
  const sd1 = std(d1)
  const sd2 = std(d2)
  // series แบนเกินไป — สัญญาณไม่พอประมาณ lag
  if (sd1 < 0.01 || sd2 < 0.01) return null

  const maxLag = Math.min(maxLagHours, Math.floor(d1.length / 2))
  const corrs: (number | null)[] = []
  for (let k = 0; k <= maxLag; k++) {
    // pearson r ของคู่ (d1[t−k], d2[t])
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0
    for (let t = k; t < d2.length; t++) {
      const x = d1[t - k]
      const y = d2[t]
      if (x == null || y == null) continue
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; m++
    }
    if (m < 8) { corrs.push(null); continue }
    const cov = sxy - (sx * sy) / m
    const vx = sxx - (sx * sx) / m
    const vy = syy - (sy * sy) / m
    corrs.push(vx > 1e-12 && vy > 1e-12 ? cov / Math.sqrt(vx * vy) : null)
  }

  let kBest = -1
  let rBest = -Infinity
  corrs.forEach((r, k) => {
    if (r != null && r > rBest) { rBest = r; kBest = k }
  })
  if (kBest < 0 || rBest < 0.3) return null

  // parabolic refinement รอบ peak (k−1, k, k+1)
  let lag = kBest
  const rm = corrs[kBest - 1]
  const rp = corrs[kBest + 1]
  if (rm != null && rp != null) {
    const denom = rm - 2 * rBest + rp
    if (Math.abs(denom) > 1e-9) {
      const delta = (0.5 * (rm - rp)) / denom
      if (Math.abs(delta) <= 1) lag = kBest + delta
    }
  }
  lag = Math.max(0.5, Math.min(maxLagHours, lag))

  // attenuation = regression slope ของ d2 บน d1 ที่ lag = kBest
  let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0
  for (let t = kBest; t < d2.length; t++) {
    const x = d1[t - kBest]
    const y = d2[t]
    if (x == null || y == null) continue
    sx += x; sy += y; sxx += x * x; sxy += x * y; m++
  }
  const vx = sxx - (sx * sx) / m
  let attenuation = vx > 1e-12 ? (sxy - (sx * sy) / m) / vx : 1
  attenuation = Math.max(0.1, Math.min(1.2, attenuation))

  return { lagHours: lag, correlation: rBest, attenuation }
}

// ── Channel hydraulics (trapezoidal cross-section, Manning) ─────────────────

export type ChannelGeometry = {
  bottomWidthM: number // ความกว้างท้องน้ำ (m)
  sideSlope: number    // ลาดตลิ่ง z (horizontal:vertical)
  manningN: number     // สัมประสิทธิ์ความขรุขระ Manning
  bedSlope: number     // ความลาดท้องน้ำ S (m/m)
  lengthKm: number     // ระยะทางระหว่างสถานี
}

function manningQ(y: number, g: ChannelGeometry): number {
  const A = (g.bottomWidthM + g.sideSlope * y) * y
  const P = g.bottomWidthM + 2 * y * Math.sqrt(1 + g.sideSlope * g.sideSlope)
  const R = A / P
  return (1 / g.manningN) * A * Math.cbrt(R * R) * Math.sqrt(g.bedSlope)
}

/**
 * แก้ normal depth y_n จาก Q ด้วย bisection บนสมการ Manning
 * (ใช้ Q + ค่าคงที่ช่องน้ำเท่านั้น — เลี่ยงปัญหา datum ของเสาวัดแต่ละสถานี
 *  ที่ทำให้ระดับน้ำเทียบข้ามสถานีตรง ๆ ไม่ได้)
 */
export function normalDepth(q: number, g: ChannelGeometry): number | null {
  if (!Number.isFinite(q) || q <= 1) return null
  let lo = 0.001
  let hi = 30
  if (manningQ(hi, g) < q) return null
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (manningQ(mid, g) < q) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function flowVelocity(q: number, g: ChannelGeometry): number | null {
  const y = normalDepth(q, g)
  if (y == null) return null
  const A = (g.bottomWidthM + g.sideSlope * y) * y
  return q / A
}

/** kinematic wave celerity c ≈ (5/3)·v สำหรับช่องน้ำกว้าง */
export function waveCelerity(q: number, g: ChannelGeometry): number | null {
  const v = flowVelocity(q, g)
  return v == null ? null : (5 / 3) * v
}

export function travelTimeHours(q: number, g: ChannelGeometry): number | null {
  const c = waveCelerity(q, g)
  if (c == null || c <= 0.01) return null
  return (g.lengthKm * 1000) / c / 3600
}

// ── Muskingum routing ────────────────────────────────────────────────────────

/**
 * Muskingum: O_t = C0·I_t + C1·I_{t−1} + C2·O_{t−1}
 * กัน C0 < 0 (ต้องมี Δt ≥ 2KX) ด้วยการแบ่งเป็น sub-reach n = ceil(2KX/Δt)
 * แล้ว route ต่อกัน — lag รวมยังคง ≈ K
 */
export function muskingumRoute(
  inflow: number[],
  kHours: number,
  x = 0.2,
  dtHours = 0.25,
): number[] {
  if (inflow.length === 0) return []
  const K = Math.max(kHours, 2 * x * dtHours) // clamp กัน K เล็กจน C0 ติดลบแม้ n=1
  const nSub = Math.max(1, Math.ceil((2 * K * x) / dtHours))
  const k = K / nSub

  let cur = inflow
  for (let s = 0; s < nSub; s++) {
    const denom = 2 * k * (1 - x) + dtHours
    const c0 = (dtHours - 2 * k * x) / denom
    const c1 = (dtHours + 2 * k * x) / denom
    const c2 = (2 * k * (1 - x) - dtHours) / denom
    const out: number[] = new Array(cur.length)
    out[0] = cur[0]
    for (let t = 1; t < cur.length; t++) {
      out[t] = Math.max(0, c0 * cur[t] + c1 * cur[t - 1] + c2 * out[t - 1])
    }
    cur = out
  }
  return cur
}

// ── Scenario builder ─────────────────────────────────────────────────────────

export type PulseShape = 'spike' | 'ramp' | 'sustained'

export type Scenario = {
  shape: PulseShape
  riseMeters: number     // ขนาดการเปลี่ยนระดับต้นน้ำ (ติดลบได้ เช่น preset แล้ง)
  durationHours: number  // เวลาที่ใช้ขึ้นถึงจุดสูงสุด
  startHour: number      // เริ่มเหตุการณ์กี่ชั่วโมงจากตอนนี้
}

const smoothstep = (u: number) => {
  const t = Math.max(0, Math.min(1, u))
  return t * t * (3 - 2 * t)
}

/**
 * สร้าง series ระดับน้ำต้นน้ำตามรูปทรงเหตุการณ์ วางบน baseline = ระดับ observed ล่าสุด
 * - spike (พุ่งสูงฉับพลัน): ขึ้นเร็วภายใน duration แล้ว recession แบบ exponential (น้ำป่า)
 * - ramp (ทยอยขึ้น): ขึ้นแบบ S-curve คงระดับหนึ่ง duration แล้วค่อย ๆ ลด
 * - sustained (ฝนต่อเนื่อง): ขึ้นแล้วคงระดับตลอดช่วงพยากรณ์
 */
export function buildUpstreamSeries(
  baseLevel: number,
  scenario: Scenario | null,
  horizonHours: number,
  dtHours: number,
): number[] {
  const steps = Math.round(horizonHours / dtHours) + 1
  if (!scenario || scenario.riseMeters === 0) {
    return new Array(steps).fill(baseLevel)
  }
  const { shape, riseMeters, durationHours, startHour } = scenario
  const dur = Math.max(0.25, durationHours)
  const out: number[] = new Array(steps)
  for (let i = 0; i < steps; i++) {
    const t = i * dtHours
    const u = (t - startHour) / dur
    let f = 0
    if (u > 0) {
      if (shape === 'spike') {
        f = u <= 1 ? smoothstep(u) : Math.exp(-(u - 1) / 1.0)
      } else if (shape === 'ramp') {
        f = u <= 1 ? smoothstep(u) : u <= 2 ? 1 : Math.exp(-(u - 2) / 3.0)
      } else {
        f = smoothstep(u) // sustained — ค้างที่ 1
      }
    }
    out[i] = baseLevel + riseMeters * f
  }
  return out
}

// ── Forecast orchestration ───────────────────────────────────────────────────

export type ForecastTier = 'discharge' | 'level' | 'none'
export type TravelSource = 'correlation' | 'manning' | 'fallback'

export type HistoryPoint = {
  h1: number | null
  q1: number | null
  h2: number | null
  q2: number | null
}

export type ThresholdSet = {
  warning: number
  prepare: number
  critical: number
  danger: number
}

export type ThresholdEta = {
  key: keyof ThresholdSet
  label: string
  level: number
  etaHours: number
}

export type Forecast = {
  tier: ForecastTier
  dtHours: number
  horizonHours: number
  times: number[]              // ชั่วโมงนับจากตอนนี้ (0..horizon)
  s1Level: number[]            // ระดับต้นน้ำจำลอง
  s2Level: (number | null)[]   // ระดับปลายน้ำพยากรณ์
  s1Q: (number | null)[]
  s2Q: (number | null)[]
  rating1: RatingCurve | null
  rating2: RatingCurve | null
  lag: LagEstimate | null
  travelHours: number
  travelSource: TravelSource
  velocityMs: number | null    // ความเร็วน้ำที่ Q ปัจจุบัน (Manning)
  celerityMs: number | null
  baseline1: number | null     // ระดับ observed ล่าสุด (จุดตั้งต้น scenario)
  baseline2: number | null
  peak: { level: number; atHour: number } | null
  thresholdEtas: ThresholdEta[]
}

const ETA_LABELS: Record<keyof ThresholdSet, string> = {
  warning: 'เฝ้าระวัง',
  prepare: 'เตรียมพร้อม',
  critical: 'วิกฤต',
  danger: 'อันตราย',
}

/** เติมช่องว่าง ≤ maxGap จุดด้วย linear interpolation — ยาวกว่านั้นคงเป็น null */
export function interpolateGaps(
  series: (number | null)[],
  maxGap = 3,
): (number | null)[] {
  const out = [...series]
  let i = 0
  while (i < out.length) {
    if (out[i] != null) { i++; continue }
    const start = i
    while (i < out.length && out[i] == null) i++
    const gapLen = i - start
    const before = start > 0 ? out[start - 1] : null
    const after = i < out.length ? out[i] : null
    if (gapLen <= maxGap && before != null && after != null) {
      for (let j = 0; j < gapLen; j++) {
        out[start + j] = before + ((after - before) * (j + 1)) / (gapLen + 1)
      }
    }
  }
  return out
}

function lastValid(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i]
  }
  return null
}

/** อ่านค่า series รายชั่วโมง ณ เวลา t ชั่วโมงก่อนจุดสุดท้าย (linear interp) */
function sampleHourly(series: (number | null)[], hoursBack: number): number | null {
  const idx = series.length - 1 - hoursBack
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo < 0 || hi >= series.length) return null
  const a = series[lo]
  const b = series[hi]
  if (a == null || b == null) return null
  return a + (b - a) * (idx - lo)
}

/** อ่านค่า forecast array (ระยะ dtHours) ณ เวลา tHours ด้วย linear interp */
export function sampleForecast(
  arr: (number | null)[],
  dtHours: number,
  tHours: number,
): number | null {
  if (arr.length === 0) return null
  const idx = Math.max(0, Math.min(arr.length - 1, tHours / dtHours))
  const lo = Math.floor(idx)
  const hi = Math.min(arr.length - 1, Math.ceil(idx))
  const a = arr[lo]
  const b = arr[hi]
  if (a == null || b == null) return a ?? b
  return a + (b - a) * (idx - lo)
}

export function computeForecast(input: {
  history: HistoryPoint[]
  scenario: Scenario | null
  /** manual mode: แปลงเป้าหมายระดับต้นน้ำเป็น ramp 1 ชม. ภายใน */
  manual: { s1Level: number } | null
  geometry: ChannelGeometry
  thresholds2: ThresholdSet
  fallbackTravelHours: [number, number]
  horizonHours?: number
  dtHours?: number
}): Forecast {
  const {
    history, geometry, thresholds2, fallbackTravelHours,
    horizonHours = 12, dtHours = 0.25,
  } = input

  const h1 = interpolateGaps(history.map((r) => r.h1))
  const q1 = interpolateGaps(history.map((r) => r.q1))
  const h2 = interpolateGaps(history.map((r) => r.h2))
  const q2 = interpolateGaps(history.map((r) => r.q2))

  const baseline1 = lastValid(h1)
  const baseline2 = lastValid(h2)

  const steps = Math.round(horizonHours / dtHours) + 1
  const times = Array.from({ length: steps }, (_, i) => i * dtHours)

  const empty: Forecast = {
    tier: 'none', dtHours, horizonHours, times,
    s1Level: new Array(steps).fill(baseline1 ?? 0),
    s2Level: new Array(steps).fill(null),
    s1Q: new Array(steps).fill(null),
    s2Q: new Array(steps).fill(null),
    rating1: null, rating2: null, lag: null,
    travelHours: (fallbackTravelHours[0] + fallbackTravelHours[1]) / 2,
    travelSource: 'fallback',
    velocityMs: null, celerityMs: null,
    baseline1, baseline2, peak: null, thresholdEtas: [],
  }

  // Tier C: ข้อมูลไม่พอ
  if (history.length < 24 || baseline1 == null) return empty

  // ── Fit / estimate จากข้อมูลจริง ──
  const toPairs = (hs: (number | null)[], qs: (number | null)[]) => {
    const pairs: { h: number; q: number }[] = []
    for (let i = 0; i < hs.length; i++) {
      if (hs[i] != null && qs[i] != null) pairs.push({ h: hs[i]!, q: qs[i]! })
    }
    return pairs
  }
  const rating1 = fitRatingCurve(toPairs(h1, q1))
  const rating2 = fitRatingCurve(toPairs(h2, q2))
  const lag = estimateLag(h1, h2)

  // เวลาเดินทาง: correlation lag → Manning → ค่าตั้งต้นจาก config
  // (clamp lag จากข้อมูลให้อยู่ใน ±50% ของช่วง fallback กันค่าหลุดโลก)
  const [fbLo, fbHi] = fallbackTravelHours
  const currentQ1 = lastValid(q1) ?? (rating1 ? ratingQ(rating1, baseline1) : null)
  const manningT = currentQ1 != null ? travelTimeHours(currentQ1, geometry) : null

  let travelHours: number
  let travelSource: TravelSource
  if (lag != null) {
    travelHours = Math.max(fbLo * 0.5, Math.min(fbHi * 1.5, lag.lagHours))
    travelSource = 'correlation'
  } else if (manningT != null) {
    travelHours = Math.max(fbLo * 0.5, Math.min(fbHi * 1.5, manningT))
    travelSource = 'manning'
  } else {
    travelHours = (fbLo + fbHi) / 2
    travelSource = 'fallback'
  }

  const velocityMs = currentQ1 != null ? flowVelocity(currentQ1, geometry) : null
  const celerityMs = currentQ1 != null ? waveCelerity(currentQ1, geometry) : null

  // ── สร้าง series ต้นน้ำตามโหมด ──
  const scenario: Scenario | null = input.scenario
    ?? (input.manual != null
      ? { shape: 'ramp', riseMeters: input.manual.s1Level - baseline1, durationHours: 1, startHour: 0 }
      : null)
  const s1Level = buildUpstreamSeries(baseline1, scenario, horizonHours, dtHours)

  let tier: ForecastTier
  let s2Level: (number | null)[]
  let s1Q: (number | null)[]
  let s2Q: (number | null)[]

  if (rating1 && rating2) {
    // ── Tier A: route ใน Q-domain ด้วย Muskingum ──
    tier = 'discharge'
    s1Q = s1Level.map((h) => ratingQ(rating1, h))

    // warm-up ด้วย Q1 observed 24 ชม. ล่าสุด (forward-fill ช่องที่ยังว่าง)
    const warmHours = Math.min(24, history.length - 1)
    const warmSteps = Math.round(warmHours / dtHours)
    const warm: number[] = []
    let lastQ = lastValid(q1) ?? s1Q[0]!
    for (let i = warmSteps; i >= 1; i--) {
      const v = sampleHourly(q1, i * dtHours)
      if (v != null) lastQ = v
      warm.push(lastQ)
    }
    const inflow = [...warm, ...(s1Q as number[])]
    const routed = muskingumRoute(inflow, travelHours, 0.2, dtHours)
    const future = routed.slice(warmSteps)

    // lateral inflow scaling จากข้อมูลจริง + anchor ที่ Q2 observed ล่าสุด
    let sumQ1 = 0, sumQ2 = 0, m = 0
    for (let i = 0; i < history.length; i++) {
      if (q1[i] != null && q2[i] != null) { sumQ1 += q1[i]!; sumQ2 += q2[i]!; m++ }
    }
    const alpha = m >= 6 && sumQ1 > 0
      ? Math.max(0.3, Math.min(3, sumQ2 / sumQ1))
      : 1
    const q2Last = lastValid(q2)
    const bias = q2Last != null ? q2Last - alpha * future[0] : 0
    s2Q = future.map((v) => Math.max(0, alpha * v + bias))
    s2Level = s2Q.map((v) => (v == null ? null : ratingH(rating2, v)))
  } else if (baseline2 != null) {
    // ── Tier B: lag-and-attenuate บน level anomaly ──
    // attenuation จาก regression ของข้อมูลจริงเมื่อหาได้ — ช่วงน้ำนิ่ง (หา lag
    // ไม่ได้) ใช้ค่าตั้งต้นอนุรักษ์นิยม 0.7 คู่กับ travel time จาก Manning/config
    tier = 'level'
    const attenuation = lag?.attenuation ?? 0.7
    s1Q = rating1 ? s1Level.map((h) => ratingQ(rating1, h)) : new Array(steps).fill(null)
    s2Q = new Array(steps).fill(null)
    s2Level = times.map((t) => {
      const tLag = t - travelHours
      const s1At = tLag >= 0
        ? sampleForecast(s1Level, dtHours, tLag)
        : sampleHourly(h1, -tLag)
      if (s1At == null) return baseline2
      return baseline2 + attenuation * (s1At - baseline1)
    })
  } else {
    // ── Tier C: series แบน/ขาด — ไม่พยากรณ์ ──
    return { ...empty, rating1, rating2, travelHours, travelSource, velocityMs, celerityMs, s1Level }
  }

  // ── Peak + ETA ถึงแต่ละ threshold ของปลายน้ำ ──
  let peak: Forecast['peak'] = null
  const startLevel = s2Level[0]
  for (let i = 0; i < s2Level.length; i++) {
    const v = s2Level[i]
    if (v == null) continue
    if (peak == null || v > peak.level) peak = { level: v, atHour: times[i] }
  }
  if (peak != null && startLevel != null && peak.level - startLevel < 0.02) peak = null

  const thresholdEtas: ThresholdEta[] = []
  for (const key of ['warning', 'prepare', 'critical', 'danger'] as const) {
    const thr = thresholds2[key]
    if (thr <= 0) continue
    if (startLevel != null && startLevel >= thr) continue
    for (let i = 0; i < s2Level.length; i++) {
      const v = s2Level[i]
      if (v != null && v >= thr) {
        thresholdEtas.push({ key, label: ETA_LABELS[key], level: thr, etaHours: times[i] })
        break
      }
    }
  }

  return {
    tier, dtHours, horizonHours, times,
    s1Level, s2Level, s1Q, s2Q,
    rating1, rating2, lag,
    travelHours, travelSource, velocityMs, celerityMs,
    baseline1, baseline2, peak, thresholdEtas,
  }
}
