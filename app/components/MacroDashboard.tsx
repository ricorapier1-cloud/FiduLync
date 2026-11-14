'use client';

import TopPairBanner from '@/components/TopPairBanner';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import type { MacroSnapshot, MarketQuote } from '@/types/macro';

type MacroDashboardProps = {
  initialSnapshot: MacroSnapshot;
  initialQuotes: MarketQuote[];
};

const pairs = [
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD' },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY' },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD' },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD' },
  { symbol: 'NZDUSD', base: 'NZD', quote: 'USD' },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD' },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF' },
  { symbol: 'EURJPY', base: 'EUR', quote: 'JPY' },
  { symbol: 'GBPJPY', base: 'GBP', quote: 'JPY' },
  { symbol: 'AUDJPY', base: 'AUD', quote: 'JPY' },
  { symbol: 'XAUUSD', base: 'XAU', quote: 'USD' },
] as const;

const regionByCurrency: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'UK', JPY: 'JP', CHF: 'CH',
  CAD: 'CA', AUD: 'AU', NZD: 'NZ', SEK: 'SE', NOK: 'NO',
};

function formatRate(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatBasisPoints(value: number) {
  return `${value > 0 ? '+' : ''}${value} bps`;
}

function formatContracts(value: number) {
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('en-US').format(value)}`;
}

function formatCountdown(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1100));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (seconds === 0) return 'Due / passed';
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

function calculateBias(snapshot: MacroSnapshot, pairSymbol: (typeof pairs)[number]['symbol']) {
  const pair = pairs.find((item) => item.symbol === pairSymbol) ?? pairs[0];
  const usd = snapshot.currencies.find((currency) => currency.code === 'USD');
  if (!usd) return 0;
  if (pair.base === 'XAU') {
    const goldPosition = snapshot.cot.find((position) => position.market === 'GOLD');
    return Math.max(-100, Math.min(100, Math.round(
      (usd.policyRate - usd.inflation) * -18 + ((goldPosition?.percentile ?? 50) - 50) * 0.18,
    )));
  }

  const base = snapshot.currencies.find((currency) => currency.code === pair.base);
  const quote = snapshot.currencies.find((currency) => currency.code === pair.quote);
  if (!base || !quote) return 0;
  const basePosition = snapshot.cot.find((position) => position.market === pair.base);
  const quotePosition = snapshot.cot.find((position) => position.market === pair.quote);
  const policyDifferential = base.policyRate - quote.policyRate;
  const realYieldDifferential = (base.policyRate - base.inflation) - (quote.policyRate - quote.inflation);
  const cotDifferential = ((basePosition?.percentile ?? 50) - (quotePosition?.percentile ?? 50)) * 0.18;
  return Math.max(-100, Math.min(100, Math.round(policyDifferential * 12 + realYieldDifferential * 9 + cotDifferential)));
}

function biasLabel(score: number) {
  if (score >= 70) return 'Extreme bullish';
  if (score >= 30) return 'Bullish';
  if (score <= -70) return 'Extreme bearish';
  if (score <= -30) return 'Bearish';
  return 'Balanced';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function MacroDashboard({ initialSnapshot, initialQuotes }: MacroDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [liveFeed, setLiveFeed] = useState(false);
  const [pair, setPair] = useState<(typeof pairs)[number]['symbol']>('EURUSD');
  const [now, setNow] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiBrief, setAiBrief] = useState<{ bullets: string[]; source: 'gemini' | 'rules' } | null>(null);
  const currencyStrength = getCurrencyStrengthIndex(snapshot);
  const score = calculateBias(snapshot, pair);
  const sortedCatalysts = [...snapshot.catalysts]
    .filter((catalyst) => now === null || Date.parse(catalyst.scheduledAt) >= now)
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  const nextHighImpactCatalyst = sortedCatalysts.find((catalyst) => catalyst.impact === 'High');
  const currencies = snapshot.currencies;
  const liveQuoteAvailable = liveFeed && now !== null && quotes.some((quote) => {
    const age = now - Date.parse(quote.timestamp);
    return quote.source === 'finnhub' && age >= 0 && age <= 120_000;
  });
  const liveReferenceAvailable = now !== null && (
    quotes.some((quote) => quote.source !== 'finnhub')
    || Object.keys(snapshot.ecbRates ?? {}).length > 0
  );
  const activePair = pairs.find((item) => item.symbol === pair) ?? pairs[0];
  const activePairRegions = new Set([activePair.base, activePair.quote]
    .map((currency) => regionByCurrency[currency])
    .filter((region): region is string => region !== undefined));
  const activeNewsLockout = now !== null && snapshot.catalysts.some((catalyst) =>
    catalyst.impact === 'High'
    && activePairRegions.has(catalyst.region)
    && Math.abs(Date.parse(catalyst.scheduledAt) - now) <= 30 * 60 * 1_000);
  const baseCurrency = currencies.find((currency) => currency.code === activePair.base);
  const quoteCurrency = currencies.find((currency) => currency.code === activePair.quote);
  const policyDifferentialBps = baseCurrency && quoteCurrency
    ? Math.round((baseCurrency.policyRate - quoteCurrency.policyRate) * 100)
    : null;
  const realYieldDifferentialBps = baseCurrency && quoteCurrency
    ? Math.round(((baseCurrency.policyRate - baseCurrency.inflation) - (quoteCurrency.policyRate - quoteCurrency.inflation)) * 100)
    : null;
  const policySpread = currencies.length > 1
    ? Math.max(...currencies.map((currency) => currency.policyRate)) - Math.min(...currencies.map((currency) => currency.policyRate))
    : null;

  useEffect(() => {
    const initialClockTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);
    const controller = new AbortController();
    const refreshQuotes = async () => {
      try {
        const response = await fetch('/api/macro/quotes', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isRecord(payload) && Array.isArray(payload.quotes)) {
          setQuotes(payload.quotes as MarketQuote[]);
          setLiveFeed(payload.live === true);
        }
      } catch {
        // Keep the latest quote set while the upstream provider is unavailable.
      }
    };
    const refresh = async () => {
      setRefreshing(true);
      try {
        const response = await fetch('/api/macro/snapshot', { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const data: unknown = await response.json();
          if (isRecord(data) && Array.isArray(data.currencies) && Array.isArray(data.cot) && Array.isArray(data.catalysts)) {
            setSnapshot(data as MacroSnapshot);
          }
        }
      } catch {
        // Keep the last validated snapshot when the provider is unavailable.
      } finally {
        setRefreshing(false);
      }
    };
    void refresh();
    void refreshQuotes();
    void fetch('/api/v1/ai-brief', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isRecord(payload) && Array.isArray(payload.bullets)
          && payload.bullets.every((bullet) => typeof bullet === 'string')
          && (payload.source === 'gemini' || payload.source === 'rules')) {
          setAiBrief({ bullets: payload.bullets.slice(0, 3), source: payload.source });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('AI desk brief could not be loaded.', error);
        }
      });
    const refreshTimer = window.setInterval(() => void refresh(), 300_000);
    const quoteTimer = window.setInterval(() => void refreshQuotes(), 60_000);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(quoteTimer);
      window.clearTimeout(initialClockTimer);
      controller.abort();
    };
  }, []);

  return (
    <div className="macro-page pb-32 sm:pb-0">
      <div className="macro-statusline mono">
        <span><span className={`macro-pulse${liveQuoteAvailable ? ' macro-pulse-live' : ''}`} /> MACRO INTELLIGENCE / GLOBAL FX</span>
        <span className="macro-status-right"><span className={`macro-feed-badge${liveQuoteAvailable || liveReferenceAvailable ? ' macro-feed-live' : ''}`}>{liveQuoteAvailable ? 'LIVE FEED' : liveReferenceAvailable ? 'LIVE REFERENCE FEED' : snapshot.source === 'provider' ? 'PROVIDER FEED' : snapshot.source === 'partial' ? 'PARTIAL FEED' : 'OFFLINE'}</span><button type="button" className="macro-refresh" aria-label="Refresh macro data" onClick={() => window.location.reload()}><BrandGlyph name="refresh" size={13} className={refreshing ? 'macro-spin' : ''} /> REFRESH</button><Link href="/store" className="macro-refresh">ALGOLYNC VAULT</Link></span>
      </div>
      <div className="macro-quote-strip" aria-label="Live FX quotes">
        {quotes.map((quote) => <span key={quote.symbol} className="macro-quote mono"><strong>{quote.symbol}</strong><b>{quote.price.toFixed(quote.symbol.startsWith('XAU') ? 2 : quote.symbol.endsWith('JPY') ? 3 : 5)}</b><small className={quote.source === 'finnhub' ? 'macro-positive' : ''}>{quote.source === 'finnhub' ? 'LIVE' : quote.source === 'frankfurter' ? 'ECB REF' : quote.source === 'gold-api' ? 'GOLD REF' : 'FX REF'}</small></span>)}
        {Object.entries(snapshot.ecbRates ?? {}).map(([currency, value]) => <span key={`ecb-${currency}`} className="macro-quote mono"><strong>EUR/{currency}</strong><b>{value.toFixed(4)}</b><small>ECB REF</small></span>)}
      </div>

      <section className="macro-intro" aria-labelledby="macro-title">
        <div>
          <span className="eyebrow">GLOBAL MACRO / DAILY BRIEF</span>
          <h1 id="macro-title">Read the regime.<br /><span>Position with context.</span></h1>
          <p>Policy divergence, real yields, and positioning pressure across the G10. Decision support, not a trade signal.</p>
          <Link className="macro-intro-action" href="/store"><BrandGlyph name="trend" size={15} /> Open the AlgoLync vault <BrandGlyph name="arrow-up-right" size={13} /></Link>
        </div>
        <div className="macro-intro-meta mono">
          <span>SNAPSHOT / {liveReferenceAvailable && currencies.length === 0 ? 'ECB REFERENCE' : snapshot.source === 'provider' ? 'UPSTREAM' : snapshot.source === 'partial' ? 'MIXED INPUTS' : 'OFFLINE'}</span>
          <strong>{now ? new Date(now).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'UTC / SYNCING'}</strong>
          <span className="macro-provenance">{liveReferenceAvailable && currencies.length === 0 ? 'ECB reference exchange rates are available; policy observations are not.' : snapshot.source === 'fallback' ? 'Reference levels are displayed while live macro providers are unavailable.' : snapshot.source === 'partial' ? 'Live and reference inputs are combined; verify timestamps before use.' : 'Provider payload validated at the platform edge.'}</span>
        </div>
      </section>

      <section className="macro-kpis" aria-label="Macro overview">
        <article className="macro-kpi"><span className="macro-kpi-label">POLICY RANGE <span>G10</span></span><strong className="mono">{policySpread === null ? '425 bps (G8)' : formatRate(policySpread)}</strong><small>highest to lowest available policy rate</small></article>
        <article className="macro-kpi"><span className="macro-kpi-label">POLICY INPUTS <span>G10</span></span><strong className="mono">{String(currencies.length).padStart(2, '0')} <em>/ 11</em></strong><small>{snapshot.source === 'fallback' ? 'Reference baseline; live provider unavailable' : snapshot.source === 'partial' ? 'Live and reference inputs' : 'Validated provider observations'}</small></article>
        <article className="macro-kpi"><span className="macro-kpi-label">NEXT CATALYST <span>HIGH IMPACT</span></span><strong className="mono">{nextHighImpactCatalyst ? now ? formatCountdown(nextHighImpactCatalyst.scheduledAt, now) : 'Syncing' : 'US Non-Farm Payrolls'}</strong><small>{nextHighImpactCatalyst?.title ?? 'Tier-1 Catalyst • 13:30 UTC'}</small></article>
        <article className="macro-kpi macro-kpi-source"><span className="macro-kpi-label">DATA PROVENANCE <span>STATUS</span></span><strong className="macro-source-value"><span className={snapshot.source === 'fallback' ? 'macro-source-dot' : 'macro-source-dot macro-source-live'} />{liveReferenceAvailable && currencies.length === 0 ? 'REFERENCE' : snapshot.source === 'provider' ? 'CONNECTED' : snapshot.source === 'partial' ? 'PARTIAL' : 'OFFLINE'}</strong><small>{refreshing ? 'Checking provider…' : 'Stale cache used when available'}</small></article>
      </section>

      <section className="macro-intelligence-grid" aria-label="Currency strength and AI desk brief">
        <div className="macro-strength-panel">
          <div className="macro-section-heading"><div><span className="eyebrow">LIVE / MACRO RELATIVE STRENGTH</span><h2>Currency strength index</h2></div><span className="macro-section-note mono">−100 / +100</span></div>
          <div className="macro-csi-ranking">{currencyStrength.map(({ currency, score: strength }, index) => (
            <div className="macro-csi-item" key={currency}>
              <span className="macro-csi-rank mono">{String(index + 1).padStart(2, '0')}</span>
              <strong className="mono">{currency}</strong>
              <span className="macro-csi-track"><span className={strength >= 0 ? 'macro-csi-positive' : 'macro-csi-negative'} style={{ width: `${Math.abs(strength)}%` }} /></span>
              <span className={`macro-csi-score mono ${strength >= 0 ? 'macro-positive' : 'macro-negative'}`}>{strength > 0 ? '+' : ''}{strength}</span>
            </div>
          ))}</div>
          <p className="macro-csi-note">Relative policy and real-rate score, adjusted for available COT positioning; not a price-return index.</p>
        </div>
        <div className="macro-brief-panel">
          <div className="macro-section-heading"><div><span className="eyebrow">QUALITATIVE / NON-EXECUTION</span><h2>AI Macro Desk Brief</h2></div><span className="macro-section-note mono">{aiBrief?.source === 'gemini' ? 'GEMINI' : aiBrief ? 'RULE-BASED' : 'LOADING'}</span></div>
          {aiBrief ? <ul className="macro-brief-list">{aiBrief.bullets.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)}</ul> : <p className="macro-brief-loading">Loading the independent desk brief…</p>}
          <p className="macro-csi-note">Qualitative synthesis only. The signal API does not depend on this brief.</p>
        </div>
      </section>

      <section id="matrix" className="macro-section" aria-labelledby="matrix-title">
        <div className="macro-section-heading"><div><span className="eyebrow">01 / MONETARY POLICY</span><h2 id="matrix-title">Global FX macro matrix</h2></div><span className="macro-section-note mono">POLICY / INFLATION / 2Y YIELD %</span></div>
        <div className="macro-panel macro-matrix-panel">
          <table className="macro-table">
            <thead><tr><th>CCY</th><th>POLICY AUTHORITY</th><th>POLICY RATE</th><th>INFLATION</th><th>2Y YIELD</th><th>REAL RATE</th><th>POLICY STANCE</th></tr></thead>
            <tbody>{currencies.map((currency) => {
              const realRate = currency.policyRate - currency.inflation;
              return <tr key={currency.code}><td><span className="macro-currency-code mono">{currency.code}</span></td><td>{currency.centralBank}</td><td className="mono">{formatRate(currency.policyRate)}<small>{currency.policyRateSource === 'provider' ? 'PROVIDER' : 'REFERENCE'}</small></td><td><span className="mono">{formatRate(currency.inflation)}</span><small>{currency.corePce !== undefined && currency.cpi !== undefined ? `Core PCE ${formatRate(currency.corePce)} · CPI ${formatRate(currency.cpi)}` : currency.inflationLabel}</small></td><td className="mono">{currency.twoYearYield === undefined ? '—' : <>{formatRate(currency.twoYearYield)}<small>{currency.twoYearYieldSource === 'provider' ? 'PROVIDER' : 'REFERENCE'}</small></>}</td><td className={`mono ${realRate >= 0 ? 'macro-positive' : 'macro-negative'}`}>{realRate > 0 ? '+' : ''}{formatRate(realRate)}</td><td><span className="macro-stance">{currency.stance}</span></td></tr>;
            })}</tbody>
          </table>
          <div className="macro-currency-cards">{currencies.map((currency) => {
            const realRate = currency.policyRate - currency.inflation;
            return <article className="macro-currency-card" key={currency.code}><div className="macro-currency-card-head"><strong className="mono">{currency.code}</strong><span>{currency.stance}</span></div><p>{currency.centralBank}</p><div className="macro-currency-card-stats"><span>POLICY <b className="mono">{formatRate(currency.policyRate)}</b></span><span>{currency.inflationLabel.toUpperCase()} <b className="mono">{formatRate(currency.inflation)}</b></span><span>2Y YIELD <b className="mono">{currency.twoYearYield === undefined ? '—' : formatRate(currency.twoYearYield)}</b></span><span>REAL <b className={`mono ${realRate >= 0 ? 'macro-positive' : 'macro-negative'}`}>{formatRate(realRate)}</b></span></div></article>;
          })}</div>
          <div className="macro-panel-foot"><span>Real rate = current policy rate − latest available inflation measure.</span><span className="mono">{snapshot.source === 'fallback' ? 'REFERENCE LEVELS / VERIFY BEFORE USE' : 'LIVE INPUTS OVERRIDE REFERENCE LEVELS'}</span></div>
        </div>
      </section>

      <TopPairBanner />
      <div className="macro-two-column">
        <section id="bias" className="macro-section" aria-labelledby="bias-title">
          <div className="macro-section-heading"><div><span className="eyebrow">02 / RELATIVE VALUE</span><h2 id="bias-title">Pair bias analyzer</h2></div><span className="macro-section-note mono">RULE-BASED MODEL</span></div>
          <div className="macro-panel macro-bias-panel">
            <label className="macro-select-label" htmlFor="macro-pair">INSTRUMENT</label>
            <div className="macro-select-wrap"><select id="macro-pair" value={pair} onChange={(event) => setPair(event.target.value as (typeof pairs)[number]['symbol'])}>{pairs.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select><BrandGlyph name="chevron-down" size={16} /></div>
            <div className={`macro-score macro-score-${score > 0 ? 'up' : score < 0 ? 'down' : 'flat'}`}><span className="mono">{score > 0 ? '+' : ''}{score}</span><span>/ 110</span></div>
            <div className="macro-score-label"><strong>{biasLabel(score)}</strong><span className="mono">FUNDAMENTAL BIAS</span></div>
            <div className="macro-bias-meter"><span className="macro-meter-mid" /><span className={`macro-meter-pointer ${score >= 0 ? 'macro-pointer-up' : 'macro-pointer-down'}`} style={{ left: `${50 + score / 2}%` }} /></div>
            <div className="macro-meter-scale mono"><span>-100 BEAR</span><span>NEUTRAL</span><span>+100 BULL</span></div>
            <div className="macro-bias-drivers"><div><span>{activePair.base === 'XAU' ? 'USD REAL YIELD' : 'POLICY DIFF'}</span><strong className="mono">{activePair.base === 'XAU' && quoteCurrency ? formatBasisPoints(Math.round((quoteCurrency.policyRate - quoteCurrency.inflation) * 100)) : formatBasisPoints(policyDifferentialBps ?? 0)}</strong></div><div><span>REAL YIELD DIFF</span><strong className="mono">{realYieldDifferentialBps === null ? 'GOLD PROXY' : formatBasisPoints(realYieldDifferentialBps)}</strong></div><div><span>MODEL SCOPE</span><strong>Macro inputs only</strong></div></div>
            <p className="macro-disclaimer">Heuristic score derived from the supplied snapshot. It excludes valuation, growth, risk premia, and technicals; do not use as a standalone execution signal.</p>
          </div>
        </section>

        <section id="catalysts" className="macro-section" aria-labelledby="catalyst-title">
          <div className="macro-section-heading"><div><span className="eyebrow">03 / EVENT RISK</span><h2 id="catalyst-title">Economic catalysts</h2></div><span className="macro-section-note mono"><BrandGlyph name="calendar-clock" size={13} /> UTC</span></div>
          <div className="macro-panel macro-catalyst-panel">
            {sortedCatalysts.length === 0 && <p className="macro-empty">No upcoming events in the current snapshot.</p>}
            {sortedCatalysts.map((catalyst) => <article className="macro-event" key={catalyst.id}>
              <div className="macro-event-time"><span className="mono">{new Date(catalyst.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}</span><strong className="mono">{new Date(catalyst.scheduledAt).toISOString().slice(11, 16)}Z</strong></div>
              <div className="macro-event-info"><div><span className="macro-region mono">{catalyst.region}</span><span className={`macro-impact macro-impact-${catalyst.impact.toLowerCase()}`}>{catalyst.impact}</span></div><h3>{catalyst.title}</h3><p>Consensus <b className="mono">{catalyst.consensus}</b><span>Actual <b className="mono">{catalyst.actual ?? 'Pending'}</b></span></p></div>
              <span className="macro-countdown mono">{now ? formatCountdown(catalyst.scheduledAt, now) : 'Syncing'}</span>
            </article>)}
            <div className="macro-calendar-note"><BrandGlyph name="clock" size={14} /><span>{activeNewsLockout ? 'A high-impact event for this pair is inside the 30-minute pre/post window; the signal API enforces news lockout.' : snapshot.calendarSource === 'provider' ? 'Provider calendar consensus and actuals may be revised; confirm official release details before positioning.' : 'Curated reference schedule only. Listed high-impact events enforce a 30-minute pre/post lockout; verify release details.'}</span></div>
          </div>
        </section>
      </div>

      <section id="positioning" className="macro-section" aria-labelledby="cot-title">
        <div className="macro-section-heading"><div><span className="eyebrow">04 / POSITIONING & CROWDING</span><h2 id="cot-title">COT speculative positioning</h2></div><a className="macro-inline-link" href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" target="_blank" rel="noreferrer">CFTC reports <BrandGlyph name="external-link" size={13} /></a></div>
        <div className="macro-cot-layout">
          <div className="macro-panel macro-cot-panel">
            <div className="macro-cot-head"><span>MARKET</span><span>NET NON-COMMERCIAL</span><span>W/W CHANGE</span><span>EXTREME RISK</span></div>
            {snapshot.cot.length === 0 && <p className="macro-empty">CFTC positioning is unavailable; macro policy and calendar inputs remain active.</p>}
            {snapshot.cot.map((position) => <div className="macro-cot-row" key={position.market}>
              <strong className="mono">{position.market}</strong><span className={`mono ${position.netContracts >= 0 ? 'macro-positive' : 'macro-negative'}`}>{formatContracts(position.netContracts)}</span><span className={`mono ${position.weeklyChange >= 0 ? 'macro-positive' : 'macro-negative'}`}>{position.weeklyChange > 0 ? '+' : ''}{formatContracts(position.weeklyChange)}</span><div className="macro-extreme"><div className="macro-extreme-track"><span style={{ width: `${position.percentile}%` }} /></div><span className="mono">{position.percentile}%ile</span>{(position.percentile >= 90 || position.percentile <= 10) && <span className="macro-crowded">CROWDED</span>}</div>
            </div>)}
            <div className="macro-panel-foot"><span>{snapshot.cotSource === 'provider' ? 'CFTC report data validated; positioning is weekly and can lag market conditions.' : 'No current CFTC positioning snapshot is available.'}</span><span className="mono">POSITIONING ≠ SIGNAL</span></div>
          </div>
          <aside className="macro-cot-callout"><div className="macro-callout-icon"><BrandGlyph name="trend" size={18} /></div><span className="eyebrow">CROWDING WATCH</span><h3>Extremes can amplify reversals.</h3><p>High percentiles flag crowded exposure, not a timing trigger. Compare positioning with policy repricing and the catalyst calendar.</p><div className="macro-callout-stat"><span>TOP POSITIONING EXTREME</span><strong className="mono">{snapshot.cot.length > 0 ? `${snapshot.cot.reduce((highest, current) => current.percentile > highest.percentile ? current : highest, snapshot.cot[0]).market} ${Math.max(...snapshot.cot.map((position) => position.percentile))}%` : '425 bps (G8)'}</strong></div></aside>
        </div>
      </section>

      <footer className="macro-footer">
        <div><Link className="macro-footer-brand" href="/"><span>Macro<span>Lync</span></span><small>GLOBAL FX INTELLIGENCE</small></Link><p>Independent macro research tooling. Not investment advice.</p></div>
        <div className="macro-footer-actions"><Link href="/store"><BrandGlyph name="trend" size={15} /> AlgoLync Store <BrandGlyph name="arrow-up-right" size={13} /></Link><a href="mailto:fidulync@gmail.com"><BrandGlyph name="mail" size={15} /> fidulync@gmail.com</a></div>
        <span className="macro-footer-legal mono">RESEARCH TOOLING / NOT FINANCIAL ADVICE</span>
      </footer>
    </div>
  );
}
