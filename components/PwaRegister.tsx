'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('PWA ServiceWorker registered with scope:', reg.scope))
        .catch((err) => console.error('PWA ServiceWorker registration failed:', err))
    }
  }, [])

  return null
}
