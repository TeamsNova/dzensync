'use client'

import Script from 'next/script'

export default function LucideLoader() {
  return (
    <Script 
      src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined' && (window as any).lucide) {
          (window as any).lucide.createIcons();
          const observer = new MutationObserver(() => {
            (window as any).lucide.createIcons();
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      }}
    />
  )
}
