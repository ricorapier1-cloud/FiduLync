import type { Metadata } from 'next';
import Link from 'next/link';
import AlgoLyncAccountPortal from '@/components/AlgoLyncAccountPortal';

export const metadata: Metadata = {
  title: 'AlgoLync Customer Account',
  description: 'Manage AlgoLync LIVE and DEMO MT5 seats, account bindings and 72-hour rebind eligibility.',
};

export default function AccountPage() {
  return <main className=\"mx-auto min-h-[75vh] w-full max-w-7xl px-5 py-8 pb-44 text-slate-100\"><Link href=\"/\" className=\"mb-6 inline-flex font-mono text-xs text-emerald-300 hover:underline\">← BACK TO TERMINAL</Link><AlgoLyncAccountPortal /></main>;
}
