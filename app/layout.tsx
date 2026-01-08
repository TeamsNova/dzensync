import type { Metadata } from 'next'
import './globals.css'

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
      <head>
        <script src="https://unpkg.com/lucide@latest" defer></script>
      </head>
      <body>{children}</body>
    </html>
  )
}
