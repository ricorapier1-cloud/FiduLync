import type { Metadata } from 'next';
import CustomerLicensePortal from '@/components/CustomerLicensePortal';

export const metadata: Metadata = { title: 'Customer License Portal', description: 'Private license status, account telemetry and MT5 account transfer.' };
export default function CustomerPage() { return <CustomerLicensePortal />; }
