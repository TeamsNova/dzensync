import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zenith Sync 3.0',
  description: 'AI Assistant powered by Groq',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
