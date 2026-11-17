import type { Metadata } from 'next';
import CustomerLicensePortal from '@/components/CustomerLicensePortal';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'My AlgoLync Workspace',
  description: 'Private subscription, MT5 account and telemetry workspace.',
};

export default function PortalPage() {
  return <CustomerLicensePortal />;
}
