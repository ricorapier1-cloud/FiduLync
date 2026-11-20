import './globals.css';
import './macro.css';
import { JetBrains_Mono } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import PlatformShell from '@/components/PlatformShell';
import { getAppBaseUrl } from '@/lib/serverConfig';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  applicationName: 'FiduLync Personal Quant Edition',
  title: {
    default: 'FiduLync Personal Quant | Private Trading Intelligence',
    template: '%s | FiduLync Personal Quant',
  },
  description: 'Private quantitative market research, disciplined risk planning and MT5 EA supervision for personal trading.',
  robots: { index: false, follow: false, noarchive: true },
  openGraph: {
    type: 'website',
    siteName: 'FiduLync Personal Quant',
    title: 'FiduLync Personal Quant | Private Trading Intelligence',
    description: 'Private quantitative market research, disciplined risk planning and MT5 EA supervision for personal trading.',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FiduLync Personal Quant | Private Trading Intelligence',
    description: 'Private quantitative market research, disciplined risk planning and MT5 EA supervision for personal trading.',
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
