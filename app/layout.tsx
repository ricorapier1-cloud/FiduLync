import './globals.css'
import type { Metadata, Viewport } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'
import PwaRegister from '@/components/PwaRegister'

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://dulync.vercel.app'),
  title: 'FiduLync | SafeLync Escrow & AlgoLync',
  description: 'P2P Escrow protection for social commerce and quantitative MQL5 trading tools.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FiduLync',
  },
  openGraph: {
    title: 'FiduLync SafeLync Escrow',
    description: 'Lock payment safely until delivery is confirmed.',
    url: 'https://dulync.vercel.app',
    siteName: 'FiduLync',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <meta name="application-name" content="FiduLync" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FiduLync" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#020617" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">
        <PwaRegister />
        {children}
        <WhatsAppButton phoneNumber="2348037212445" />
      </body>
    </html>
  )
}
