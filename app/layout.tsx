import './globals.css';
import './macro.css';
import { JetBrains_Mono } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import PlatformShell from '@/components/PlatformShell';
import { getAppBaseUrl } from '@/lib/serverConfig';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  applicationName: 'MacroLync & AlgoLync Terminal',
  title: {
    default: 'MacroLync & AlgoLync | Institutional Trading Terminal',
    template: '%s | MacroLync & AlgoLync',
  },
  description: 'MacroLync quantitative FX and macro research with the AlgoLync strategy vault and MT5 telemetry bridge.',
  openGraph: {
    type: 'website',
    siteName: 'MacroLync & AlgoLync',
    title: 'MacroLync & AlgoLync | Institutional Trading Terminal',
    description: 'MacroLync quantitative FX and macro research with the AlgoLync strategy vault and MT5 telemetry bridge.',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MacroLync & AlgoLync | Institutional Trading Terminal',
    description: 'MacroLync FX research, AlgoLync strategies, event risk, and MT5 fleet telemetry.',
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
