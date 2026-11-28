export default function EABridgeDiagnostics() {
  const macroContextSchema = {
    schema_version: '1.0.0',
    generated_at_utc: 'ISO-8601 UTC',
    timezone: 'Africa/Lagos',
    allowedToTrade: false,
    biasScore: null,
    directionalVerdict: 'INSUFFICIENT_EVIDENCE',
    newsLockoutActive: true,
    activeSession: 'LONDON | NY | CLOSED',
    macroRiskRegime: 'REGIME_ENUM',
    decisionScope: 'MACRO_GATE_ONLY',
    symbols: {
      EURUSD: { biasScore: null, directionalVerdict: 'INSUFFICIENT_EVIDENCE', macroRiskRegime: 'INSUFFICIENT_EVIDENCE', confidence: 'INSUFFICIENT_EVIDENCE' },
      XAUUSD: { biasScore: null, directionalVerdict: 'INSUFFICIENT_EVIDENCE', macroRiskRegime: 'INSUFFICIENT_EVIDENCE', confidence: 'INSUFFICIENT_EVIDENCE' },
    },
  };
  const goldContextSchema = {
    generatedAtUtc: 'ISO-8601 UTC',
    overallState: 'AVAILABLE | INSUFFICIENT_EVIDENCE | UNAVAILABLE',
    goldBiasScore: null,
    directionalVerdict: 'BULLISH | BEARISH | NEUTRAL | INSUFFICIENT_EVIDENCE',
    evidenceCoveragePct: 0,
    liquidityRegime: 'RISK_ON_CARRY | NEUTRAL_BALANCED | RISK_OFF_DELEVERAGING | INSUFFICIENT_EVIDENCE',
    drivers: { DFII10: null, T10YIE: null, DGS2: null, DTB3: null, VIXCLS: null },
    cot: { market: 'COMEX GOLD (088691)', nonCommercialNet: null, reportDate: null },
  };

  return (
    <section id="ea-diagnostics" className="macro-section scroll-mt-24" aria-labelledby="ea-diagnostics-title">
      <details className="rounded-xl border border-white/10 bg-[#0b1119] p-4 sm:p-5">
        <summary id="ea-diagnostics-title" className="cursor-pointer list-none font-mono text-sm font-semibold text-slate-100">
          <span className="text-emerald-300">ZONE 4</span> · EA BRIDGE &amp; SYSTEM DIAGNOSTICS · API SCHEMA ONLY · EXPAND
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">Unified MT5 Macro Context</h3>
            <p className="mt-1 text-xs text-slate-400">API response contract example only—not live market data. Runtime values are read from the authenticated endpoint; null values mean verified evidence is insufficient and the EA must not infer a direction.</p>
            <code className="mt-2 block break-all rounded bg-black/30 p-2 text-[11px] text-emerald-300">GET /api/v1/macro-context?symbol=EURUSD</code>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[10px] leading-relaxed text-slate-300">{JSON.stringify(macroContextSchema, null, 2)}</pre>
          </article>
          <article className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">Dedicated XAU/USD Context</h3>
            <p className="mt-1 text-xs text-slate-400">Gold API response contract example only—not live market data. Runtime Treasury, CBOE VIX and CFTC fields are populated only from provider observations.</p>
            <code className="mt-2 block break-all rounded bg-black/30 p-2 text-[11px] text-emerald-300">GET /api/v1/xauusd-context</code>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[10px] leading-relaxed text-slate-300">{JSON.stringify(goldContextSchema, null, 2)}</pre>
          </article>
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
          <b className="font-mono text-emerald-300">MQL5 CONNECTION GUIDE</b>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Add <code>https://fidulync.vercel.app</code> to the MT5 terminal WebRequest allow-list.</li>
            <li>Send the private <code>MACRO_API_TOKEN</code> as a Bearer token for both endpoints. The macro-context endpoint also accepts <code>x-macro-key</code>; the dedicated XAUUSD endpoint accepts Bearer authorization only. Never put secrets in URLs, logs, or shared source files.</li>
            <li>Fail closed on HTTP errors, stale data, <code>newsLockoutActive=true</code>, or missing directional evidence.</li>
            <li>Use <code>allowedToTrade</code> as the macro gate only. The EA must independently enforce technical confirmation, broker-native lot sizing, spread, account risk, and its WAT daily circuit breaker.</li>
          </ol>
          <a className="mt-3 inline-flex text-emerald-300 underline" href="/mql5/MacroLyncBridge.mqh" download>Download MacroLyncBridge.mqh</a>
        </div>
      </details>
    </section>
  );
}
