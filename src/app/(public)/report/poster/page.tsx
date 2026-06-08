import type { Metadata } from 'next'
import { Poster } from './Poster'

export const metadata: Metadata = {
  title: 'โปสเตอร์ QR แจ้งเหตุน้ำท่วม',
  robots: { index: false },
}

export default function PosterPage() {
  return <Poster />
}
