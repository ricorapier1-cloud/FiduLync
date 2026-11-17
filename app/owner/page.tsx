import type { Metadata } from 'next';
import OwnerConsole from '@/components/OwnerConsole';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'FiduLync Owner Console',
  description: 'Private owner license and MT5 market-data publisher controls.',
};

export default function OwnerPage() {
  return <OwnerConsole />;
}
