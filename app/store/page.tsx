import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'AlgoLync Strategy Store',
  description: 'Browse AlgoLync strategies, request eligible demo access and configure recurring subscriptions.',
};

export default function AlgoLyncStorePage() {
  return <StoreTerminal />;
}
