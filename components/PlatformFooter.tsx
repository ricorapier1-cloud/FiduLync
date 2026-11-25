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
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.08] hover:text-emerald-300"
            >
              <span className="text-sm">←</span> Return to previous view
            </button>
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                <BrandGlyph name="shield" size={16} />
              </span>
              <span className="text-base font-semibold tracking-tight text-slate-100">
                Macro<span className="text-emerald-400">Lync</span>
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Institutional quantitative macroeconomic and fundamental foreign-exchange intelligence center. Concentrates exclusively on understanding macroeconomic drivers, monetary policy divergence, and cross-asset capital flows.
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">Research Modules</span>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/" className="transition hover:text-emerald-300">
                  Macro Intelligence Terminal
                </Link>
              </li>
              <li>
                <Link href="/notebook" className="transition hover:text-emerald-300">
                  Macro Research Notebook
                </Link>
              </li>
              <li>
                <Link href="/workbench" className="transition hover:text-emerald-300">
                  Validation &amp; Backtest Workbench
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-emerald-300">
                  Methodology &amp; Architecture FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">Desk Operations</span>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="text-slate-300">PRIVATE PERSONAL RESEARCH</li>
              <li className="text-slate-400">Macro intelligence · WAT / UTC</li>
              <li className="text-slate-500 font-mono text-[11px]">Read-only EA context · No order execution</li>
            </ul>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">MT5 Context Interface</span>
            <div className="mt-3 flex flex-col gap-2 text-xs">
              <span className="text-[11px] text-slate-400">
                External read-only JSON bridge for connected MT5 EAs:
              </span>
              <code className="text-[10px] bg-white/[0.04] p-1.5 rounded text-emerald-300 font-mono">
                GET /api/v1/macro-context?symbol=EURUSD
              </code>
              <a
                href="/MacroLyncBridge.mqh"
                download
                className="inline-flex items-center gap-2 rounded border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300 mt-1"
              >
                <BrandGlyph name="arrow-down" size={13} /> MacroLyncBridge.mqh
              </a>
            </div>
          </div>
        </div>

        {/* Regulatory & Research Disclaimer */}
        <div className="mt-10 rounded-xl border border-white/[0.06] bg-[#0c1016] p-4 text-[10px] leading-5 text-slate-400 sm:p-5">
          <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-amber-300">
            <BrandGlyph name="shield-alert" size={14} className="text-amber-300" />
            Institutional Research Governance &amp; Market Risk Warning
          </div>
          <p className="mt-2 text-slate-400">
            Foreign exchange trading and cross-asset investments carry significant financial risk. MacroLync produces quantitative models, macroeconomic regime classifications, and fundamental relative-value metrics strictly for research, analysis, and educational purposes. MacroLync does not execute broker orders, manage client funds, or provide personalized investment advice.
          </p>
          <p className="mt-2 text-slate-500">
            Technical trading decisions, leverage management, and order execution remain the sole responsibility of individual traders and their independent execution systems.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6 font-mono text-[10px] text-slate-400">
          <div>© {new Date().getFullYear()} MacroLync Institutional Research Center. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/faq" className="hover:text-slate-300">FAQ</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
