import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/db/schema'

const connectionString = process.env.DATABASE_URL

let db: ReturnType<typeof drizzle<typeof schema>>

if (connectionString) {
  const client = postgres(connectionString, { prepare: false })
  db = drizzle(client, { schema })
}

export function getDb() {
  if (!db) throw new Error('DATABASE_URL is not configured')
  return db
}

export { db }
