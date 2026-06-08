import { existsSync, readFileSync } from 'node:fs'

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    process.env[line.slice(0, i)] ??= line.slice(i + 1)
  }
}

import { incidents, incidentAreas } from './schema'
import { eq } from 'drizzle-orm'

async function test() {
  const { getDb } = await import('../lib/db')
  const db = getDb()

  const list = await db
    .select()
    .from(incidents)
  
  console.log('All Incidents in DB:')
  for (const inc of list) {
    const areas = await db
      .select()
      .from(incidentAreas)
      .where(eq(incidentAreas.incidentId, inc.id))
    console.log(`- Incident: ${inc.name} (${inc.id}), status: ${inc.status}, province: ${inc.province}, amphoe: ${inc.amphoe}`)
    console.log(`  Areas:`, JSON.stringify(areas, null, 2))
  }
  process.exit(0)
}

test().catch(console.error)
