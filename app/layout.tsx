import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FiduLync | Trust Locked Into Every Link',
  description: 'Secure P2P escrow payment links. Lock funds safely until delivery is confirmed.',
  keywords: ['escrow', 'payments', 'FiduLync', 'peer to peer', 'secure payments', 'buyer protection'],
  authors: [{ name: 'FiduLync Technologies' }],
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
      <body className={inter.className}>{children}</body>
    </html>
  )
}
