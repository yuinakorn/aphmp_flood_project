/**
 * npm run db:seed
 * นำข้อมูล demo จาก public/data/ เข้า DB
 */
import { getDb } from '@/lib/db'
import { floodPoints, floodPolygons, vulnerablePersons, infrastructures } from './schema'

async function main() {
  const db = getDb()

  // --- Flood Points ---
  const fp = await import('../../public/data/flood-points.json', { assert: { type: 'json' } })
  const pointRows = fp.default.features.map((f: any) => ({
    lat: String(f.geometry.coordinates[1]),
    lng: String(f.geometry.coordinates[0]),
    intensity: f.properties.intensity as number,
    observedAt: '2024-08-01',
  }))
  await db.insert(floodPoints).values(pointRows).onConflictDoNothing()
  console.log(`Inserted ${pointRows.length} flood points`)

  // --- S2 Polygons ---
  const s2 = await import('../../public/data/s2-flood-polygons.json', { assert: { type: 'json' } })
  const polyRows = s2.default.features.map((f: any) => ({
    geojson: JSON.stringify(f.geometry),
    tambon: f.properties.name ?? null,
    province: 'น่าน',
    source: 'sentinel-2',
    observedAt: '2025-07-24',
  }))
  await db.insert(floodPolygons).values(polyRows).onConflictDoNothing()
  console.log(`Inserted ${polyRows.length} flood polygons`)

  // --- Vulnerable ---
  const vuln = await import('../../public/data/vulnerable.json', { assert: { type: 'json' } })
  const vulnRows = (vuln.default as any[]).map((p) => ({
    name: p.name,
    type: p.type,
    label: p.label,
    age: p.age,
    cond: p.cond,
    equipment: p.eq ?? null,
    village: p.vil,
    lat: String(p.lat),
    lng: String(p.lng),
    consent: true,
  }))
  await db.insert(vulnerablePersons).values(vulnRows).onConflictDoNothing()
  console.log(`Inserted ${vulnRows.length} vulnerable persons`)

  // --- Infra ---
  const infra = await import('../../public/data/infrastructure.json', { assert: { type: 'json' } })
  const infraRows = (infra.default as any[]).map((i) => ({
    name: i.name,
    type: i.type,
    capacity: parseInt(i.cap) || null,
    lat: String(i.lat),
    lng: String(i.lng),
    icon: i.icon,
  }))
  await db.insert(infrastructures).values(infraRows).onConflictDoNothing()
  console.log(`Inserted ${infraRows.length} infrastructures`)

  process.exit(0)
}

main().catch(console.error)
