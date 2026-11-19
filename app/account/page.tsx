import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Account',
  description: 'AlgoLync customer license and account management.',
};

export default function AccountPage() {
  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-3xl px-5 py-10 pb-44 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">ALGOLYNC / CUSTOMER ACCESS</p>
        <h1 className="mt-3 text-3xl font-semibold">Customer account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Manage your AlgoLync product license, Paystack purchase and MT5 seat assignments from the secure store portal.</p>
      </header>
      <Link href="/store#vault-checkout" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120d]">Open licensing and seat manager</Link>
    </main>
  );
}
