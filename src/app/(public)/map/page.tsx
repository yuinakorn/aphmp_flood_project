import { MapClient } from './MapClient'

export const metadata = {
  title: 'FloodWatch — แผนที่น้ำท่วม',
  description: 'ระบบติดตามน้ำท่วม ด้วยข้อมูล Sentinel-1/2 และ GISTDA',
}

export default function MapPage() {
  return <MapClient />
}
