/**
 * npm run db:seed:geo
 * นำข้อมูลที่อยู่มาตรฐาน (จังหวัด/อำเภอ/ตำบล จากกรมการปกครอง DOPA)
 * จาก src/db/seed-data/geo/*.json เข้า DB
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    const key = line.slice(0, i)
    const value = line.slice(i + 1)
    process.env[key] ??= value
  }
}

interface RawProvince { id: number; name_th: string; name_en: string | null; deleted_at: string | null }
interface RawDistrict { id: number; name_th: string; name_en: string | null; province_id: number; deleted_at: string | null }
interface RawSubdistrict { id: number; name_th: string; name_en: string | null; district_id: number; zip_code: number | null; deleted_at: string | null }

const DATA_DIR = join(process.cwd(), 'src/db/seed-data/geo')

function load<T>(file: string): T[] {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T[]
}

// แบ่ง insert เป็นก้อนเพื่อเลี่ยง limit จำนวน parameter ของ Postgres
async function insertChunked<T>(
  rows: T[],
  insertFn: (chunk: T[]) => Promise<unknown>,
  size = 500,
) {
  for (let i = 0; i < rows.length; i += size) {
    await insertFn(rows.slice(i, i + size))
  }
}

async function main() {
  const { getDb } = await import('@/lib/db')
  const { geoProvinces, geoDistricts, geoSubdistricts } = await import('./schema')
  const db = getDb()

  const provinces = load<RawProvince>('province.json').filter((p) => !p.deleted_at)
  const districts = load<RawDistrict>('district.json').filter((d) => !d.deleted_at)
  const subdistricts = load<RawSubdistrict>('sub_district.json').filter((s) => !s.deleted_at)

  console.log(`โหลด: ${provinces.length} จังหวัด, ${districts.length} อำเภอ, ${subdistricts.length} ตำบล`)

  // ล้างของเดิมก่อน (idempotent) — เรียงตามลำดับ FK
  await db.delete(geoSubdistricts)
  await db.delete(geoDistricts)
  await db.delete(geoProvinces)

  await insertChunked(
    provinces.map((p) => ({ id: p.id, nameTh: p.name_th, nameEn: p.name_en })),
    (chunk) => db.insert(geoProvinces).values(chunk),
  )
  console.log('✓ จังหวัด')

  await insertChunked(
    districts.map((d) => ({ id: d.id, nameTh: d.name_th, nameEn: d.name_en, provinceId: d.province_id })),
    (chunk) => db.insert(geoDistricts).values(chunk),
  )
  console.log('✓ อำเภอ')

  await insertChunked(
    subdistricts.map((s) => ({
      id: s.id,
      nameTh: s.name_th,
      nameEn: s.name_en,
      zipCode: s.zip_code,
      districtId: s.district_id,
    })),
    (chunk) => db.insert(geoSubdistricts).values(chunk),
  )
  console.log('✓ ตำบล')

  console.log('เสร็จสิ้น')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
