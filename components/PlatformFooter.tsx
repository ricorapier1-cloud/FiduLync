'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandGlyph from '@/components/BrandGlyph';

export default function PlatformFooter() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';

  return (
    <footer className="mt-16 border-t border-white/[0.08] bg-[#06080c] text-slate-400">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {!isHome && (
          <div className="mb-8">
            <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.08] hover:text-emerald-300">
              <span className="text-sm">←</span> Return to previous view
            </button>
          </div>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-400"><BrandGlyph name="shield" size={16} /></span>
              <span className="text-base font-semibold tracking-tight text-slate-100">Fidu<span className="text-emerald-400">Lync</span></span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-5 text-slate-400">Institutional macroeconomic, monetary-policy and fundamental FX research with source provenance and read-only EA context.</p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">Macro research</span>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/" className="transition hover:text-emerald-300">Macro intelligence terminal</Link></li>
              <li><Link href="/analytics" className="transition hover:text-emerald-300">Cross-asset macro research</Link></li>
              <li><Link href="/research/notebook" className="transition hover:text-emerald-300">Fundamental research notebook</Link></li>
              <li><Link href="/faq" className="transition hover:text-emerald-300">MT5 macro context guide</Link></li>
            </ul>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">Governance & data</span>
            <ul className="mt-3 space-y-2 text-xs">
              <li><Link href="/terms" className="transition hover:text-emerald-300">Data provenance & research policy</Link></li>
              <li><Link href="/privacy" className="transition hover:text-emerald-300">Privacy policy</Link></li>
              <li><a href="/mql5/MacroContextBridge.mqh" download className="inline-flex items-center gap-1.5 transition hover:text-emerald-300"><BrandGlyph name="arrow-down" size={13} /> MacroContextBridge.mqh</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 rounded-xl border border-white/[0.06] bg-[#0c1016] p-4 text-[10px] leading-5 text-slate-400 sm:p-5">
          <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-amber-300"><BrandGlyph name="shield-alert" size={14} className="text-amber-300" /> Research and market risk</div>
          <p className="mt-2">Forex, CFDs, futures and precious metals carry substantial risk. Macro research is uncertain, data can be delayed or revised, and no model or scenario guarantees market direction or profit. Each EA must independently validate broker conditions and preserve local emergency protections.</p>
          <p className="mt-2">This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>FiduLync MacroLync · Private research terminal · No browser sign-in</span>
          <span>Read-only macro context · No broker order execution</span>
        </div>
      </div>
    </footer>
  );
}
