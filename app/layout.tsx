import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FiduLync | Trust Locked Into Every Link',
  description: 'Secure P2P escrow payment links. Lock funds safely until delivery is confirmed.',
  keywords: ['escrow', 'payments', 'FiduLync', 'peer to peer', 'secure payments'],
  authors: [{ name: 'FiduLync Technologies' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FiduLync',
  },
  openGraph: {
    title: 'FiduLync | Trust Locked Into Every Link',
    description: 'Protect your buyer and seller funds with instant escrow payment links.',
    siteName: 'FiduLync',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch((err) => {
                  console.error('Service Worker registration failed:', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
