import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { classifyRisk, classifyFloodLevel } from '@/lib/geo'
import type { VulnerablePerson, VulnerableType } from '@/types'
import pool from '@/lib/jhcis-db'
import { getFloodZones } from '@/lib/kml-parser'
import floodPointsData from '../../../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

export async function GET(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role ?? 'anonymous'

  const { searchParams } = new URL(req.url)
  const bbox = searchParams.get('bbox')

  let persons: VulnerablePerson[] = []

  try {
    const [rows] = await pool.query(`
      SELECT
        p.pid as id,
        CONCAT(p.fname, ' ', p.lname) AS name,
        TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) as age,
        IFNULL(h.hno, '-') AS house_number,
        IF(v.villno != 0 AND v.villno IS NOT NULL, v.villno, '') AS moo,
        sd.subdistname AS tambon,
        d.distname AS amphoe,
        CONCAT(
          IFNULL(h.hno, '-'),
          IF(v.villno != 0 AND v.villno IS NOT NULL, CONCAT(' ม.', v.villno), ''),
          IFNULL(CONCAT(' ต.', sd.subdistname), ''),
          IFNULL(CONCAT(' อ.', d.distname), '')
        ) AS full_address,
        h.xgis AS lat,
        h.ygis AS lng,
        CASE
          WHEN MAX(u.pid) IS NOT NULL THEN 'disabled'
          WHEN MAX(c.pid) IS NOT NULL THEN 'bedridden'
          WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60 THEN 'elderly'
          ELSE 'elderly'
        END as type,
        CASE
          WHEN MAX(u.pid) IS NOT NULL THEN 'ผู้พิการ/ทุพพลภาพ'
          WHEN MAX(c.pid) IS NOT NULL THEN 'ผู้ป่วยโรคเรื้อรัง'
          WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60 THEN 'ผู้สูงอายุ'
          ELSE 'กลุ่มเปราะบางอื่นๆ'
        END as label
      FROM person p
      INNER JOIN house h 
        ON p.hcode = h.hcode AND p.pcucodeperson = h.pcucode
      LEFT JOIN village v
        ON h.pcucode = v.pcucode AND h.villcode = v.villcode
      LEFT JOIN csubdistrict sd 
        ON SUBSTRING(h.villcode, 1, 2) = sd.provcode 
        AND SUBSTRING(h.villcode, 3, 2) = sd.distcode 
        AND SUBSTRING(h.villcode, 5, 2) = sd.subdistcode
      LEFT JOIN cdistrict d 
        ON SUBSTRING(h.villcode, 1, 2) = d.provcode 
        AND SUBSTRING(h.villcode, 3, 2) = d.distcode
      LEFT JOIN personunable u 
        ON p.pid = u.pid AND p.pcucodeperson = u.pcucodeperson
      LEFT JOIN personchronic c 
        ON p.pid = c.pid AND p.pcucodeperson = c.pcucodeperson
      WHERE (h.xgis IS NOT NULL AND h.xgis != '')
        AND p.dischargetype = '9'
        AND p.typelive IN ('1', '3')
        AND (
          TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60
          OR u.pid IS NOT NULL
          OR c.pid IS NOT NULL
        )
      GROUP BY p.pid
    `)

    persons = (rows as any[]).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type as VulnerableType,
      label: row.label,
      age: row.age,
      cond: row.label, // Using label as condition for display
      vil: row.moo ? `${row.house_number} ม.${row.moo}` : row.house_number,
      tambon: row.tambon || '-',
      amphoe: row.amphoe || '-',
      fullAddress: row.full_address,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
    }))
  } catch (error) {
    console.error("Error fetching vulnerable groups from JHCIS:", error)
    return NextResponse.json({ error: "Failed to fetch from DB" }, { status: 500 })
  }

  if (bbox) {
    const parts = bbox.split(',').map(Number)
    if (parts.length === 4 && !parts.some(isNaN)) {
      const [minLng, minLat, maxLng, maxLat] = parts
      persons = persons.filter(
        (p) => p.lng >= minLng && p.lng <= maxLng && p.lat >= minLat && p.lat <= maxLat,
      )
    }
  }

  const zones = getFloodZones()
  const enriched = persons.map((p) => {
    const risk = classifyRisk(p.lat, p.lng, floodCoords)
    const floodLevel = classifyFloodLevel(p.lat, p.lng, zones)
    return { ...p, risk, floodLevel }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['admin', 'officer'].includes(session.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  // TODO: validate + insert into DB
  return NextResponse.json({ success: true, data: body }, { status: 201 })
}
