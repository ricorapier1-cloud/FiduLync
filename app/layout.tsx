import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'veriPay',
  description: 'Secure Escrow Payment Service',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
