import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { Droplets, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ALERT_STYLES,
  STATION_THRESHOLDS,
  classifyAlert,
  type AlertLevel,
} from '@/lib/water-level'
import { WaterLevelChart } from './WaterLevelChart'

export const metadata = { title: 'ระดับน้ำรายชั่วโมง — FloodWatch Admin' }
export const dynamic = 'force-dynamic'

type Row = {
  observed_at: Date
  date: string
  time: string
  p67: number | null
  p67_discharge: number | null
  p1: number | null
  p1_discharge: number | null
}

async function loadHourly(hours = 72) {
  const db = getDb()
  const rows = await db.execute(sql`
    SELECT
      observed_at,
      to_char(observed_date, 'YYYY-MM-DD') AS date,
      to_char(observed_time, 'HH24:MI')    AS time,
      level_station1::float                AS p67,
      discharge_station1::float            AS p67_discharge,
      level_station2::float                AS p1,
      discharge_station2::float            AS p1_discharge
    FROM water_level_observation
    WHERE station_id1 = 'P.67' AND station_id2 = 'P.1'
    ORDER BY observed_at DESC
    LIMIT ${hours}
  `)
  return (rows as unknown as Row[]).reverse()
}

function rise(series: (number | null)[], idx: number, hoursBack: number) {
  const cur = series[idx]
  const prev = series[idx - hoursBack]
  if (cur == null || prev == null) return null
  return Number((cur - prev).toFixed(2))
}

function StationCard({
  code,
  level,
  rise3h,
  rise1h,
  discharge,
}: {
  code: 'P.67' | 'P.1'
  level: number | null
  rise3h: number | null
  rise1h: number | null
  discharge: number | null
}) {
  const t = STATION_THRESHOLDS[code]
  const alert: AlertLevel = classifyAlert(level, rise3h, t)
  const style = ALERT_STYLES[alert]
  const TrendIcon =
    rise1h == null || rise1h === 0
      ? Minus
      : rise1h > 0
        ? TrendingUp
        : TrendingDown

  return (
    <div
      className={`rounded-md border px-5 py-4 ${style.bg} transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            {code}
          </p>
          <p className="mt-0.5 text-[13px] font-medium tracking-tight">
            {t.name}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-current/30 px-2 py-0.5 text-[10.5px] font-medium ${style.text}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="font-mono text-[32px] font-semibold leading-none tracking-tight">
          {level == null ? '—' : level.toFixed(2)}
        </span>
        <span className="pb-1 text-[11px] text-[var(--fg-muted)]">m</span>
        <span className="ml-auto inline-flex items-center gap-1 pb-1.5 text-[11px] text-[var(--fg-muted)]">
          <TrendIcon size={12} strokeWidth={2} />
          <span className="font-mono">
            {rise1h == null
              ? '—'
              : `${rise1h > 0 ? '+' : ''}${rise1h.toFixed(2)}`}
          </span>
          /1h
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3 text-[11px]">
        <div>
          <dt className="text-[var(--fg-subtle)]">เพิ่ม 3 ชม.</dt>
          <dd className="mt-0.5 font-mono text-[var(--fg)]">
            {rise3h == null
              ? '—'
              : `${rise3h > 0 ? '+' : ''}${rise3h.toFixed(2)}`}{' '}
            m
          </dd>
        </div>
        <div>
          <dt className="text-[var(--fg-subtle)]">Discharge</dt>
          <dd className="mt-0.5 font-mono text-[var(--fg)]">
            {discharge == null ? '—' : discharge.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--fg-subtle)]">วิกฤต</dt>
          <dd className="mt-0.5 font-mono text-[var(--fg)]">
            {t.critical.toFixed(1)} m
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default async function WaterLevelPage() {
  const rows = await loadHourly(72)

  const p67Series = rows.map((r) => r.p67)
  const p1Series = rows.map((r) => r.p1)

  const lastIdx = rows.length - 1
  const last = rows[lastIdx]

  const p67Rise1 = rise(p67Series, lastIdx, 1)
  const p67Rise3 = rise(p67Series, lastIdx, 3)
  const p1Rise1 = rise(p1Series, lastIdx, 1)
  const p1Rise3 = rise(p1Series, lastIdx, 3)

  const chartData = rows.map((r) => ({
    observedAt: r.observed_at.toString(),
    date: r.date,
    time: r.time,
    p67: r.p67,
    p67Discharge: r.p67_discharge,
    p1: r.p1,
    p1Discharge: r.p1_discharge,
  }))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            ลุ่มน้ำปิง · P.67 → P.1
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-[22px] font-semibold tracking-tight">
            <Droplets size={20} strokeWidth={1.75} className="text-sky-400" />
            ระดับน้ำรายชั่วโมง
          </h1>
          <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
            <span className="font-mono">{rows.length}</span> ชั่วโมงล่าสุด · อัปเดต{' '}
            <span className="font-mono">
              {last?.date} {last?.time}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <StationCard
          code="P.67"
          level={last?.p67 ?? null}
          rise1h={p67Rise1}
          rise3h={p67Rise3}
          discharge={last?.p67_discharge ?? null}
        />
        <StationCard
          code="P.1"
          level={last?.p1 ?? null}
          rise1h={p1Rise1}
          rise3h={p1Rise3}
          discharge={last?.p1_discharge ?? null}
        />
      </div>

      <div className="mt-4">
        <WaterLevelChart
          data={chartData}
          thresholds={{
            p67: STATION_THRESHOLDS['P.67'].critical,
            p1: STATION_THRESHOLDS['P.1'].critical,
          }}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--bg-elevated)] text-[var(--fg-subtle)]">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">วัน-เวลา</th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                P.67 (m)
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                P.67 Q
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                P.1 (m)
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                P.1 Q
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                ส่วนต่าง
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {[...rows].reverse().slice(0, 24).map((r, i) => {
              const diff =
                r.p67 != null && r.p1 != null ? r.p67 - r.p1 : null
              return (
                <tr key={i} className="hover:bg-[var(--bg-elevated)]">
                  <td className="px-3 py-1.5 font-mono text-[11.5px] text-[var(--fg-muted)]">
                    {r.date} {r.time}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {r.p67?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--fg-muted)]">
                    {r.p67_discharge?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {r.p1?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--fg-muted)]">
                    {r.p1_discharge?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--fg-muted)]">
                    {diff == null
                      ? '—'
                      : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
