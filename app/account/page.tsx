import type { Metadata } from 'next';
import CustomerLicensePortal from '@/components/CustomerLicensePortal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'My AlgoLync License',
  description: 'Secure customer license dashboard and MT5 account management.',
};

export default function CustomerAccountPage() {
  return <CustomerLicensePortal />;
}
