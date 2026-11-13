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
        {/* Inner Page Back Button */}
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
                Macro<span className="text-emerald-400">Lync</span> &amp; Algo<span className="text-emerald-400">Lync</span>
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Institutional quantitative macroeconomic intelligence terminal, proprietary EA execution architecture, and automated MT5 telemetry bridge.
            </p>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">Terminal Modules</span>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/" className="transition hover:text-emerald-300">
                  Macro Intelligence Terminal
                </Link>
              </li>
              <li>
                <Link href="/store" className="transition hover:text-emerald-300">
                  AlgoLync Strategy Vault &amp; Store
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-emerald-300">
                  Terminal &amp; Strategy FAQ
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition hover:text-emerald-300">
                  Terms &amp; Risk Disclosure
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">Support &amp; Desk</span>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href="https://wa.me/2348037212445?text=Hello%20Desk%2C%20I%20have%20an%20enquiry%20regarding%20AlgoLync%20EAs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-300 transition hover:underline"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  WhatsApp: +234 803 721 2445
                </a>
              </li>
              <li className="text-slate-400">Lagos / London Trading Desk Hours</li>
              <li className="text-slate-500 font-mono text-[11px]">Mon – Fri: 07:00 – 21:00 UTC</li>
            </ul>
          </div>

          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-300">MT5 Include Files</span>
            <div className="mt-3 flex flex-col gap-2 text-xs">
              <a
                href="/mql5/MacroLyncLicense.mqh"
                download
                className="inline-flex items-center gap-2 rounded border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
              >
                <BrandGlyph name="arrow-down" size={13} /> MacroLyncLicense.mqh
              </a>
              <a
                href="/mql5/MacroLyncBridge.mqh"
                download
                className="inline-flex items-center gap-2 rounded border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
              >
                <BrandGlyph name="arrow-down" size={13} /> MacroLyncBridge.mqh
              </a>
            </div>
          </div>
        </div>

        {/* Regulatory & Capital Risk Warning */}
        <div className="mt-10 rounded-xl border border-white/[0.06] bg-[#0c1016] p-4 text-[10px] leading-5 text-slate-400 sm:p-5">
          <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-amber-300">
            <BrandGlyph name="shield-alert" size={14} className="text-amber-300" />
            High Risk Capital Warning &amp; Legal Disclaimer
          </div>
          <p className="mt-2 text-slate-400">
            Trading foreign exchange (Forex) and Contracts for Difference (CFDs) on margin carries a high level of risk and may not be suitable for all investors. High leverage can work against you as well as for you. Before deciding to trade foreign exchange or utilize automated Expert Advisors, you should carefully consider your investment objectives, level of experience, and risk appetite. There is a possibility that you could sustain a loss of some or all of your initial capital. Past performance, backtests, or hypothetical results are not indicative of future market outcomes.
          </p>
          <p className="mt-2 text-slate-500">
            MacroLync and AlgoLync provide quantitative analysis, macro intelligence models, and execution software tools for research and automated trading execution. We do not provide personalized financial, legal, or investment advice.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6 font-mono text-[10px] text-slate-400">
          <div>© {new Date().getFullYear()} MacroLync &amp; AlgoLync. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/faq" className="hover:text-slate-300">FAQ</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
            <Link href="/terms#privacy" className="hover:text-slate-300">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
