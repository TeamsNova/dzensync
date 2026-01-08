import type { Metadata } from 'next'
import './globals.css'
import LucideLoader from './components/LucideLoader'

export const metadata: Metadata = {
  title: 'Zenith Sync 3.0',
  description: 'AI Assistant',
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
