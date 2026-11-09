import './globals.css';
import { JetBrains_Mono, Sora } from 'next/font/google';
import PlatformShell from '@/components/PlatformShell';
import WhatsAppFloat from '@/components/WhatsAppFloat';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata = {
  title: 'FiduLync | Institutional escrow & AlgoLync',
  description: 'Protected transactions and independently verifiable MetaTrader tools.',
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
