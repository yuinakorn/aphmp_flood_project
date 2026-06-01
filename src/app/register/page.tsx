import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { geoProvinces } from '@/db/schema'
import { ALLOWED_PROVINCES } from '@/lib/provinces'
import { RegisterClient } from './RegisterClient'

export const metadata = { title: 'ลงทะเบียนเจ้าหน้าที่ — GIS Health Intelligence' }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ cid?: string }>
}) {
  const { cid } = await searchParams
  const db = getDb()
  const provinces = await db
    .select({ nameTh: geoProvinces.nameTh })
    .from(geoProvinces)
    .where(inArray(geoProvinces.nameTh, ALLOWED_PROVINCES as unknown as string[]))
    .orderBy(asc(geoProvinces.nameTh))

  return <RegisterClient initialCid={cid ?? ''} provinces={provinces.map((p) => p.nameTh)} />
}
