'use client'

import { useEffect } from 'react'
import { PWAInstallPrompt } from './pwa-install-prompt'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration.scope)

            // Check for updates periodically
            setInterval(() => {
              registration.update()
            }, 60 * 60 * 1000) // Check every hour
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error)
          })
      })

      // Handle service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker updated')
        // Optionally show a notification to reload
      })
    }
  }, [])

  return (
    <>
      {children}
      <PWAInstallPrompt />
    </>
  )
}
