import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  metadataBase: new URL('https://fidulync.vercel.app'),
  title: 'FiduLync - Trust Locked Into Every Link',
  description: 'Strategic market escrow and multi-currency secure payouts.',
  openGraph: {
    title: 'FiduLync - Trust Locked Into Every Link',
    description: 'Strategic market escrow and multi-currency secure payouts.',
    url: 'https://fidulync.vercel.app',
    siteName: 'FiduLync',
    locale: 'en_US',
    type: 'website',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0B1120] text-white antialiased selection:bg-emerald-500/30">
        {children}
        <Toaster 
          position="bottom-center" 
          toastOptions={{ 
            style: { background: '#111827', color: '#fff', border: '1px solid #1f2937' },
            success: { iconTheme: { primary: '#10b981', secondary: '#111827' } }
          }} 
        />
      </body>
    </html>
  )
}
