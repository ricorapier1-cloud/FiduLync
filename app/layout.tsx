import './globals.css';
import './macro.css';
import { JetBrains_Mono } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import PlatformShell from '@/components/PlatformShell';
import { getAppBaseUrl } from '@/lib/serverConfig';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  applicationName: 'MacroLync Institutional Terminal',
  title: {
    default: 'MacroLync | Institutional Macro & Fundamental Intelligence Center',
    template: '%s | MacroLync',
  },
  description: 'Institutional macroeconomic intelligence platform, central-bank divergence tracking, real-yield differentials, and read-only MT5 fundamental context.',
  openGraph: {
    type: 'website',
    siteName: 'MacroLync',
    title: 'MacroLync | Institutional Macro & Fundamental Intelligence Center',
    description: 'Institutional macroeconomic intelligence platform, central-bank divergence tracking, real-yield differentials, and read-only MT5 fundamental context.',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MacroLync | Institutional Macro & Fundamental Intelligence Center',
    description: 'Institutional macroeconomic intelligence platform, central-bank divergence tracking, real-yield differentials, and read-only MT5 fundamental context.',
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
