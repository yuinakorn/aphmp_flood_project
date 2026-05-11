import type { Metadata } from 'next'
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'FloodWatch',
  description:
    'ระบบติดตามน้ำท่วม ด้วยข้อมูล Sentinel-1/2 SAR และ GISTDA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
