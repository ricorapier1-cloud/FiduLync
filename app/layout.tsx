import './globals.css'
import type { Metadata } from 'next'
import WhatsAppButton from '@/components/WhatsAppButton'

export const metadata: Metadata = {
  metadataBase: new URL('https://dulync.vercel.app'),
  title: 'FiduLync | SafeLync Escrow & AlgoLync Quant Suite',
  description: 'P2P Escrow protection for social commerce and quantitative MQL5 trading tools.',
  openGraph: {
    title: 'FiduLync SafeLync Escrow',
    description: 'Lock payment safely until delivery is confirmed.',
    url: 'https://dulync.vercel.app',
    siteName: 'FiduLync',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
        <WhatsAppButton phoneNumber="2348037212445" />
      </body>
    </html>
  )
}
