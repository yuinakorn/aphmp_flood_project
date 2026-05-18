import { getDb } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { Droplets, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ALERT_STYLES,
  STATION_THRESHOLDS,
  PROVINCE_CONFIGS,
  classifyAlert,
  type AlertLevel,
  type ProvinceId,
} from '@/lib/water-level'
import { WaterLevelChart } from './WaterLevelChart'
import { WaterFlowSimulator } from './WaterFlowSimulator'
import { ProvinceSelector } from './ProvinceSelector'

export const metadata = { title: 'ระดับน้ำรายชั่วโมง — FloodWatch Admin' }
export const dynamic = 'force-dynamic'

type Row = {
  observed_at: Date
  date: string
  time: string
  s1: number | null
  s1_discharge: number | null
  s2: number | null
  s2_discharge: number | null
}

async function loadHourly(station1: string, station2: string, hours = 72) {
  const db = getDb()
  const rows = await db.execute(sql`
    SELECT
      observed_at,
      to_char(observed_date, 'YYYY-MM-DD') AS date,
      to_char(observed_time, 'HH24:MI')    AS time,
      level_station1::float                AS s1,
      discharge_station1::float            AS s1_discharge,
      level_station2::float                AS s2,
      discharge_station2::float            AS s2_discharge
    FROM water_level_observation
    WHERE station_id1 = ${station1} AND station_id2 = ${station2}
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
  code: string
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

export default async function WaterLevelPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string }>
}) {
  const params = await searchParams
  const provinceId = (
    params.province && params.province in PROVINCE_CONFIGS
      ? params.province
      : 'chiangmai'
  ) as ProvinceId
  const config = PROVINCE_CONFIGS[provinceId]

  const rows = await loadHourly(config.s1, config.s2, 72)

  const s1Series = rows.map((r) => r.s1)
  const s2Series = rows.map((r) => r.s2)

  const lastIdx = rows.length - 1
  const last = rows[lastIdx]

  const s1Rise1 = rise(s1Series, lastIdx, 1)
  const s1Rise3 = rise(s1Series, lastIdx, 3)
  const s2Rise1 = rise(s2Series, lastIdx, 1)
  const s2Rise3 = rise(s2Series, lastIdx, 3)

  const chartData = rows.map((r) => ({
    observedAt: r.observed_at.toString(),
    date: r.date,
    time: r.time,
    s1: r.s1,
    s1Discharge: r.s1_discharge,
    s2: r.s2,
    s2Discharge: r.s2_discharge,
  }))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            {config.river} · {config.s1} → {config.s2}
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
        <ProvinceSelector current={provinceId} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <StationCard
          code={config.s1}
          level={last?.s1 ?? null}
          rise1h={s1Rise1}
          rise3h={s1Rise3}
          discharge={last?.s1_discharge ?? null}
        />
        <StationCard
          code={config.s2}
          level={last?.s2 ?? null}
          rise1h={s2Rise1}
          rise3h={s2Rise3}
          discharge={last?.s2_discharge ?? null}
        />
      </div>

      <div className="mt-4">
        <WaterFlowSimulator
          s1={{
            level: last?.s1 ?? null,
            discharge: last?.s1_discharge ?? null,
            rise3h: s1Rise3,
          }}
          s2={{
            level: last?.s2 ?? null,
            discharge: last?.s2_discharge ?? null,
            rise3h: s2Rise3,
          }}
          config={config}
        />
      </div>

      <div className="mt-4">
        <WaterLevelChart
          data={chartData}
          thresholds={{
            s1: STATION_THRESHOLDS[config.s1].critical,
            s2: STATION_THRESHOLDS[config.s2].critical,
          }}
          station1={config.s1}
          station2={config.s2}
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--bg-elevated)] text-[var(--fg-subtle)]">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">วัน-เวลา</th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                {config.s1} (m)
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                {config.s1} Q
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                {config.s2} (m)
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                {config.s2} Q
              </th>
              <th className="px-3 py-2 text-right font-mono font-medium">
                ส่วนต่าง
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {[...rows].reverse().slice(0, 24).map((r, i) => {
              const diff =
                r.s1 != null && r.s2 != null ? r.s1 - r.s2 : null
              return (
                <tr key={i} className="hover:bg-[var(--bg-elevated)]">
                  <td className="px-3 py-1.5 font-mono text-[11.5px] text-[var(--fg-muted)]">
                    {r.date} {r.time}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {r.s1?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--fg-muted)]">
                    {r.s1_discharge?.toFixed(1) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {r.s2?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[var(--fg-muted)]">
                    {r.s2_discharge?.toFixed(1) ?? '—'}
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
