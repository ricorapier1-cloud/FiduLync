import type { Metadata } from 'next';
import AlgoLyncAccountPortal from '@/components/AlgoLyncAccountPortal';

export const metadata: Metadata = {
  title: 'AlgoLync Customer Account',
  description: 'Manage AlgoLync LIVE and DEMO MT5 seats, account bindings and 72-hour rebind eligibility.',
};

export default function AccountPage() {
  return <AlgoLyncAccountPortal />;
}
