import './globals.css';
import WhatsAppFloat from '@/components/WhatsAppFloat';

export const metadata = { title: 'FiduLync | Secure Escrow & Quant Store' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#05080c] text-white min-h-screen font-sans antialiased">
        {children}
        <WhatsAppFloat />
      </body>
    </html>
  );
}
