import Link from 'next/link';
import { PaystackCheckout } from '@/components/PaystackCheckout';

export default function StorePage() {
  return (
    <main className="min-h-screen bg-[#030A08] text-emerald-50 px-4 py-12 pb-32">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-xs font-mono text-emerald-400 hover:underline">
            ← BACK TO MACRO TERMINAL
          </Link>
          <span className="text-xs font-mono text-emerald-400/70">INSTITUTIONAL LICENSING</span>
        </div>
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3">AlgoLync Vault</h1>
          <p className="text-sm text-emerald-200/70 max-w-xl mx-auto">
            Automated account-bound licensing with live MacroLync rollover protection and cloud heartbeat telemetry.
          </p>
        </div>
        <PaystackCheckout />
      </div>
    </main>
  );
}
