import './globals.css';
import './macro.css';
import { JetBrains_Mono, Sora } from 'next/font/google';
import type { Metadata } from 'next';
import PlatformShell from '@/components/PlatformShell';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import { getAppBaseUrl } from '@/lib/serverConfig';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  title: 'MacroLync | Global FX Intelligence',
  description: 'Institutional-style foreign exchange macro research, policy divergence, catalyst risk, and positioning context.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jetBrainsMono.variable}`}>
      <body className={sora.className}>
        <PlatformShell>{children}</PlatformShell>
        <WhatsAppFloat />
      </body>
    </html>
  );
}
