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
          
          let timeout: NodeJS.Timeout | null = null;
          const observer = new MutationObserver(() => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
              (window as any).lucide?.createIcons();
            }, 100);
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      }}
    />
  )
}
