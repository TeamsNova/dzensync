import type { Metadata, Viewport } from 'next'
import './globals.css'
import LucideLoader from './components/LucideLoader'

export const metadata: Metadata = {
  title: 'Zenith Sync 3.0',
  description: 'AI Assistant',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        {children}
        <LucideLoader />
      </body>
    </html>
  )
}
