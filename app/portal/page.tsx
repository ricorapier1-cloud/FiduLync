import type { Metadata } from 'next';
import CustomerLicensePortal from '@/components/CustomerLicensePortal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'AlgoLync Client Workspace',
  description: 'Private subscriptions, MT5 account slots and account-isolated telemetry.',
};

export default function AlgoLyncPortalPage() {
  return <CustomerLicensePortal />;
}
