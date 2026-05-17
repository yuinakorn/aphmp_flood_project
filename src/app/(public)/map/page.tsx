import { MapClient } from './MapClient'
import { auth } from '@/lib/auth'

export const metadata = {
  title: 'FloodWatch — แผนที่น้ำท่วม',
  description: 'ระบบติดตามน้ำท่วม ด้วยข้อมูล Sentinel-1/2 และ GISTDA',
}

export default async function MapPage() {
  const session = await auth()
  const mapSession = session?.user
    ? { role: session.user.role ?? 'viewer', name: session.user.name ?? '' }
    : null

  return <MapClient session={mapSession} />
}
