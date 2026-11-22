import './globals.css';
import './macro.css';
import { JetBrains_Mono } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import PlatformShell from '@/components/PlatformShell';
import { getAppBaseUrl } from '@/lib/serverConfig';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  applicationName: 'FiduLync MacroLync',
  title: {
    default: 'FiduLync MacroLync | Fundamental Intelligence',
    template: '%s | FiduLync MacroLync',
  },
  description: 'Private institutional macroeconomic, monetary-policy, cross-asset and fundamental FX research with source provenance and a read-only MT5 macro context bridge.',
  robots: { index: false, follow: false, noarchive: true },
  openGraph: {
    type: 'website',
    siteName: 'FiduLync MacroLync',
    title: 'FiduLync MacroLync | Fundamental Intelligence',
    description: 'Macroeconomic and fundamental FX research with source provenance. No broker order execution.',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FiduLync MacroLync | Fundamental Intelligence',
    description: 'Macroeconomic and fundamental FX research with source provenance. No broker order execution.',
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
      </body>
    </html>
  );
}
