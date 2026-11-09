import Link from 'next/link';
import { ArrowUpRight, CircleHelp, FileWarning, ShieldCheck } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="page-content max-w-3xl">
      <header className="page-heading">
        <div>
          <div className="eyebrow">CLIENT SUPPORT</div>
          <h1>Help when it matters.</h1>
          <p>Find the right path for a payment question, delivery issue or AlgoLync verification request.</p>
        </div>
        <CircleHelp className="text-[#51e4c2]" size={22} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/disputes" className="panel group p-5 transition hover:border-emerald-300/25">
          <FileWarning size={19} className="text-[#51e4c2]" />
          <h2 className="mt-4 text-sm font-semibold">Report a transaction issue</h2>
          <p className="mt-2 text-xs leading-6 text-slate-500">Submit your escrow reference, a detailed statement and supporting evidence. Filing pauses settlement for review.</p>
          <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[#51e4c2]">Open Dispute Vault <ArrowUpRight size={14} /></span>
        </Link>
        <div className="panel p-5">
          <ShieldCheck size={19} className="text-[#51e4c2]" />
          <h2 className="mt-4 text-sm font-semibold">Before contacting support</h2>
          <p className="mt-2 text-xs leading-6 text-slate-500">Keep your private deal link and Paystack receipt available. Never share passwords, card details, one-time codes or investor-account master credentials.</p>
          <a className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[#51e4c2]" href="https://wa.me/2348037212445" target="_blank" rel="noopener noreferrer">Contact support securely <ArrowUpRight size={14} /></a>
        </div>
      </div>

      <p className="mt-5 text-[10px] leading-5 text-slate-600">Support cannot guarantee payment-provider or bank settlement times. Trading-related disputes require evidence tied to the agreed terms; market losses alone do not establish non-delivery.</p>
    </div>
  );
}
