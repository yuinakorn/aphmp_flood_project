import { MapClient } from './MapClient'
import { auth } from '@/lib/auth'

export const metadata = {
  title: 'Flood Map — GIS Health Intelligence',
  description: 'โมดูลเฝ้าระวังน้ำท่วม บนแพลตฟอร์มข้อมูลสุขภาพเชิงพื้นที่ GIS Health Intelligence',
}

export default async function MapPage() {
  const session = await auth()
  const mapSession = session?.user
    ? { id: session.user.id ?? '', role: session.user.role ?? 'viewer', name: session.user.name ?? '' }
    : null

  return <MapClient session={mapSession} />
}
