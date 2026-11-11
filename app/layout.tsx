import './globals.css';
import './macro.css';
import { JetBrains_Mono } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import PlatformShell from '@/components/PlatformShell';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import { getAppBaseUrl } from '@/lib/serverConfig';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  applicationName: 'MacroLync',
  title: {
    default: 'MacroLync | Global FX Intelligence',
    template: '%s | MacroLync',
  },
  description: 'Institutional-style foreign exchange macro research, policy divergence, catalyst risk, and positioning context.',
  openGraph: {
    type: 'website',
    siteName: 'MacroLync',
    title: 'MacroLync | Global FX Intelligence',
    description: 'Institutional-style foreign exchange macro research, policy divergence, catalyst risk, and positioning context.',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MacroLync | Global FX Intelligence',
    description: 'Institutional-style foreign exchange macro research, policy divergence, catalyst risk, and positioning context.',
    images: ['/opengraph-image.png'],
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#080a0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetBrainsMono.variable}>
      <body className={jetBrainsMono.className}>
        <PlatformShell>{children}</PlatformShell>
        <WhatsAppFloat />
      </body>
    </html>
  );
}
