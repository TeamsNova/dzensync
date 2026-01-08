import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'

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
        <Script 
          src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== 'undefined' && (window as any).lucide) {
              (window as any).lucide.createIcons();
              // Re-run on DOM changes
              const observer = new MutationObserver(() => {
                (window as any).lucide.createIcons();
              });
              observer.observe(document.body, { childList: true, subtree: true });
            }
          }}
        />
      </body>
    </html>
  )
}
