'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { MacroSnapshot } from '@/types/macro';
import PaystackPop from '@paystack/inline-js';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import MacroAccountModal from '@/components/MacroAccountModal';

type MacroDashboardProps = {
  initialSnapshot: MacroSnapshot;
  vipEnabled: boolean;
  vipPrice: number;
};

const pairs = [
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD' },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY' },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD' },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD' },
  { symbol: 'XAUUSD', base: 'XAU', quote: 'USD' },
] as const;

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
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
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

export default function MacroDashboard({ initialSnapshot, vipEnabled, vipPrice }: MacroDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pair, setPair] = useState<(typeof pairs)[number]['symbol']>('EURUSD');
  const [now, setNow] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [signedInEmail, setSignedInEmail] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const score = calculateBias(snapshot, pair);
  const sortedCatalysts = [...snapshot.catalysts]
    .filter((catalyst) => now === null || Date.parse(catalyst.scheduledAt) >= now)
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  const currencies = snapshot.currencies;
  const activePair = pairs.find((item) => item.symbol === pair) ?? pairs[0];
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
    : 0;

  useEffect(() => {
    const initialClockTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000);
    const controller = new AbortController();
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
    const refreshTimer = window.setInterval(() => void refresh(), 300_000);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      window.clearTimeout(initialClockTimer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setAccessToken(session?.access_token ?? '');
      setSignedInEmail(session?.user.email ?? '');
      if (session?.user.email) setEmail(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? '');
      setSignedInEmail(session?.user.email ?? '');
      if (session?.user.email) setEmail(session.user.email);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function beginVipCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutMessage('');
    setCheckoutBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user.email) {
        setCheckoutMessage('Sign in before subscribing to the VIP Macro Pass.');
        setAuthOpen(true);
        return;
      }
      const accountEmail = session.user.email.trim().toLowerCase();
      setEmail(accountEmail);
      const response = await fetch('/api/paystack-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: accountEmail }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload)) {
        const message = isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : 'Checkout could not be started. Please try again.';
        setCheckoutMessage(message);
        return;
      }
      if (payload.mode === 'inline'
        && typeof payload.publicKey === 'string'
        && typeof payload.reference === 'string'
        && typeof payload.planCode === 'string'
        && typeof payload.amount === 'number') {
        const paystack = new PaystackPop();
        paystack.newTransaction({
          key: payload.publicKey,
          email: accountEmail,
          amount: payload.amount,
          currency: 'NGN',
          planCode: payload.planCode,
          reference: payload.reference,
          metadata: { product: 'macro_vip_monthly' },
          onSuccess: () => setCheckoutMessage('Payment received. Your VIP access will activate after Paystack confirms the charge.'),
          onCancel: () => setCheckoutMessage('Checkout was cancelled.'),
          onError: ({ message }) => setCheckoutMessage(message || 'Paystack checkout could not be opened.'),
        });
        return;
      }
      if (typeof payload.authorizationUrl !== 'string') {
        setCheckoutMessage('Checkout could not be started. Please try again.');
        return;
      }
      window.location.assign(payload.authorizationUrl);
    } catch {
      setCheckoutMessage('Checkout is temporarily unavailable. Please try again.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <div className="macro-page">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse" /> MACRO INTELLIGENCE / GLOBAL FX</span>
        <span className="macro-status-right"><span className="macro-feed-badge">{snapshot.source === 'provider' ? 'PROVIDER FEED' : snapshot.source === 'partial' ? 'PARTIAL FEED' : 'ILLUSTRATIVE SEED'}</span><button type="button" className="macro-refresh" aria-label="Refresh macro data" onClick={() => window.location.reload()}><RefreshCw size={13} className={refreshing ? 'macro-spin' : ''} /> REFRESH</button><button type="button" className="macro-refresh" onClick={() => accessToken ? setAccountOpen(true) : setAuthOpen(true)}>{accessToken ? 'ACCOUNT' : 'SIGN IN'}</button></span>
      </div>

      <section className="macro-intro" aria-labelledby="macro-title">
        <div>
          <span className="eyebrow">GLOBAL MACRO / DAILY BRIEF</span>
          <h1 id="macro-title">Read the regime.<br /><span>Position with context.</span></h1>
          <p>Policy divergence, real yields, and positioning pressure across the G10. Decision support, not a trade signal.</p>
          <a className="macro-intro-action" href="https://wa.me/2348037212445?text=Hello%2C%20I%27d%20like%20to%20automate%20a%20macro%20strategy%20with%20an%20MT5%20Expert%20Advisor." target="_blank" rel="noreferrer"><MessageCircle size={15} /> Automate this strategy <ArrowUpRight size={13} /></a>
        </div>
        <div className="macro-intro-meta mono">
          <span>SNAPSHOT / {snapshot.source === 'provider' ? 'UPSTREAM' : snapshot.source === 'partial' ? 'MIXED INPUTS' : 'SEED BASELINE'}</span>
          <strong>{now ? new Date(now).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'UTC / --:--:--'}</strong>
          <span className="macro-provenance">{snapshot.source === 'seed' ? 'Illustrative values. Configure a provider for current observations.' : snapshot.source === 'partial' ? 'Some fields are live; remaining values use the seed baseline.' : 'Provider payload validated at the platform edge.'}</span>
        </div>
      </section>

      <section className="macro-kpis" aria-label="Macro overview">
        <article className="macro-kpi"><span className="macro-kpi-label">POLICY RANGE <span>G10</span></span><strong className="mono">{formatRate(policySpread)}</strong><small>highest to lowest policy rate</small></article>
        <article className="macro-kpi"><span className="macro-kpi-label">CENTRAL BANKS <span>TRACKED</span></span><strong className="mono">{String(currencies.length).padStart(2, '0')} <em>/ 06</em></strong><small>Fed · ECB · BoE · BoJ · RBA · SNB</small></article>
        <article className="macro-kpi"><span className="macro-kpi-label">NEXT CATALYST <span>HIGH IMPACT</span></span><strong className="mono">{sortedCatalysts[0] && now ? formatCountdown(sortedCatalysts[0].scheduledAt, now) : '—'}</strong><small>{sortedCatalysts[0]?.title ?? 'No upcoming event in feed'}</small></article>
        <article className="macro-kpi macro-kpi-source"><span className="macro-kpi-label">DATA PROVENANCE <span>STATUS</span></span><strong className="macro-source-value"><span className={snapshot.source === 'seed' ? 'macro-source-dot' : 'macro-source-dot macro-source-live'} />{snapshot.source === 'provider' ? 'CONNECTED' : snapshot.source === 'partial' ? 'PARTIAL' : 'SEED MODE'}</strong><small>{refreshing ? 'Checking provider…' : 'External feed is optional'}</small></article>
      </section>

      <section id="matrix" className="macro-section" aria-labelledby="matrix-title">
        <div className="macro-section-heading"><div><span className="eyebrow">01 / MONETARY POLICY</span><h2 id="matrix-title">Global FX macro matrix</h2></div><span className="macro-section-note mono">RATE & INFLATION / % Y/Y</span></div>
        <div className="macro-panel macro-matrix-panel">
          <table className="macro-table">
            <thead><tr><th>CCY</th><th>POLICY AUTHORITY</th><th>POLICY RATE</th><th>INFLATION</th><th>REAL RATE</th><th>POLICY STANCE</th></tr></thead>
            <tbody>{currencies.map((currency) => {
              const realRate = currency.policyRate - currency.inflation;
              return <tr key={currency.code}><td><span className="macro-currency-code mono">{currency.code}</span></td><td>{currency.centralBank}</td><td className="mono">{formatRate(currency.policyRate)}</td><td><span className="mono">{formatRate(currency.inflation)}</span><small>{currency.inflationLabel}</small></td><td className={`mono ${realRate >= 0 ? 'macro-positive' : 'macro-negative'}`}>{realRate > 0 ? '+' : ''}{formatRate(realRate)}</td><td><span className="macro-stance">{currency.stance}</span></td></tr>;
            })}</tbody>
          </table>
          <div className="macro-currency-cards">{currencies.map((currency) => {
            const realRate = currency.policyRate - currency.inflation;
            return <article className="macro-currency-card" key={currency.code}><div className="macro-currency-card-head"><strong className="mono">{currency.code}</strong><span>{currency.stance}</span></div><p>{currency.centralBank}</p><div className="macro-currency-card-stats"><span>POLICY <b className="mono">{formatRate(currency.policyRate)}</b></span><span>{currency.inflationLabel.toUpperCase()} <b className="mono">{formatRate(currency.inflation)}</b></span><span>REAL <b className={`mono ${realRate >= 0 ? 'macro-positive' : 'macro-negative'}`}>{formatRate(realRate)}</b></span></div></article>;
          })}</div>
          <div className="macro-panel-foot"><span>Real rate = policy rate − inflation proxy. Inflation measure varies by jurisdiction.</span><span className="mono">SEED VALUES ARE ILLUSTRATIVE</span></div>
        </div>
      </section>

      <div className="macro-two-column">
        <section id="bias" className="macro-section" aria-labelledby="bias-title">
          <div className="macro-section-heading"><div><span className="eyebrow">02 / RELATIVE VALUE</span><h2 id="bias-title">Pair bias analyzer</h2></div><span className="macro-section-note mono">RULE-BASED MODEL</span></div>
          <div className="macro-panel macro-bias-panel">
            <label className="macro-select-label" htmlFor="macro-pair">INSTRUMENT</label>
            <div className="macro-select-wrap"><select id="macro-pair" value={pair} onChange={(event) => setPair(event.target.value as (typeof pairs)[number]['symbol'])}>{pairs.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></div>
            <div className={`macro-score macro-score-${score > 0 ? 'up' : score < 0 ? 'down' : 'flat'}`}><span className="mono">{score > 0 ? '+' : ''}{score}</span><span>/ 100</span></div>
            <div className="macro-score-label"><strong>{biasLabel(score)}</strong><span className="mono">FUNDAMENTAL BIAS</span></div>
            <div className="macro-bias-meter"><span className="macro-meter-mid" /><span className={`macro-meter-pointer ${score >= 0 ? 'macro-pointer-up' : 'macro-pointer-down'}`} style={{ left: `${50 + score / 2}%` }} /></div>
            <div className="macro-meter-scale mono"><span>-100 BEAR</span><span>NEUTRAL</span><span>+100 BULL</span></div>
            <div className="macro-bias-drivers"><div><span>{activePair.base === 'XAU' ? 'USD REAL YIELD' : 'POLICY DIFF'}</span><strong className="mono">{activePair.base === 'XAU' && quoteCurrency ? formatBasisPoints(Math.round((quoteCurrency.policyRate - quoteCurrency.inflation) * 100)) : formatBasisPoints(policyDifferentialBps ?? 0)}</strong></div><div><span>REAL YIELD DIFF</span><strong className="mono">{realYieldDifferentialBps === null ? 'GOLD PROXY' : formatBasisPoints(realYieldDifferentialBps)}</strong></div><div><span>MODEL SCOPE</span><strong>Macro inputs only</strong></div></div>
            <p className="macro-disclaimer">Heuristic score derived from the supplied snapshot. It excludes valuation, growth, risk premia, and technicals; do not use as a standalone execution signal.</p>
          </div>
        </section>

        <section id="catalysts" className="macro-section" aria-labelledby="catalyst-title">
          <div className="macro-section-heading"><div><span className="eyebrow">03 / EVENT RISK</span><h2 id="catalyst-title">Economic catalysts</h2></div><span className="macro-section-note mono"><CalendarClock size={13} /> UTC</span></div>
          <div className="macro-panel macro-catalyst-panel">
            {sortedCatalysts.length === 0 && <p className="macro-empty">No upcoming events in the current snapshot.</p>}
            {sortedCatalysts.map((catalyst) => <article className="macro-event" key={catalyst.id}>
              <div className="macro-event-time"><span className="mono">{new Date(catalyst.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}</span><strong className="mono">{new Date(catalyst.scheduledAt).toISOString().slice(11, 16)}Z</strong></div>
              <div className="macro-event-info"><div><span className="macro-region mono">{catalyst.region}</span><span className={`macro-impact macro-impact-${catalyst.impact.toLowerCase()}`}>{catalyst.impact}</span></div><h3>{catalyst.title}</h3><p>Consensus <b className="mono">{catalyst.consensus}</b><span>Actual <b className="mono">{catalyst.actual ?? 'Pending'}</b></span></p></div>
              <span className="macro-countdown mono">{now ? formatCountdown(catalyst.scheduledAt, now) : '--'}</span>
            </article>)}
            <div className="macro-calendar-note"><Clock3 size={14} /><span>Seed dates are indicative. Confirm official release calendars before positioning.</span></div>
          </div>
        </section>
      </div>

      <section id="positioning" className="macro-section" aria-labelledby="cot-title">
        <div className="macro-section-heading"><div><span className="eyebrow">04 / POSITIONING & CROWDING</span><h2 id="cot-title">COT speculative positioning</h2></div><a className="macro-inline-link" href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" target="_blank" rel="noreferrer">CFTC reports <ExternalLink size={13} /></a></div>
        <div className="macro-cot-layout">
          <div className="macro-panel macro-cot-panel">
            <div className="macro-cot-head"><span>MARKET</span><span>NET NON-COMMERCIAL</span><span>W/W CHANGE</span><span>EXTREME RISK</span></div>
            {snapshot.cot.map((position) => <div className="macro-cot-row" key={position.market}>
              <strong className="mono">{position.market}</strong><span className={`mono ${position.netContracts >= 0 ? 'macro-positive' : 'macro-negative'}`}>{formatContracts(position.netContracts)}</span><span className={`mono ${position.weeklyChange >= 0 ? 'macro-positive' : 'macro-negative'}`}>{position.weeklyChange > 0 ? '+' : ''}{formatContracts(position.weeklyChange)}</span><div className="macro-extreme"><div className="macro-extreme-track"><span style={{ width: `${position.percentile}%` }} /></div><span className="mono">{position.percentile}%ile</span>{(position.percentile >= 90 || position.percentile <= 10) && <span className="macro-crowded">CROWDED</span>}</div>
            </div>)}
            <div className="macro-panel-foot"><span>{snapshot.cotSource === 'provider' ? 'COT feed validated; confirm the provider uses consistent CFTC report definitions.' : 'Illustrative net positions; configure a COT provider for current CFTC positioning.'}</span><span className="mono">POSITIONING ≠ SIGNAL</span></div>
          </div>
          <aside className="macro-cot-callout"><div className="macro-callout-icon"><TrendingUp size={18} /></div><span className="eyebrow">CROWDING WATCH</span><h3>Extremes can amplify reversals.</h3><p>High percentiles flag crowded exposure, not a timing trigger. Compare positioning with policy repricing and the catalyst calendar.</p><div className="macro-callout-stat"><span>TOP SEED EXTREME</span><strong className="mono">{snapshot.cot.reduce((highest, current) => current.percentile > highest.percentile ? current : highest, snapshot.cot[0] ?? { market: '—', percentile: 0 }).market} <em>{Math.max(0, ...snapshot.cot.map((position) => position.percentile))}%</em></strong></div></aside>
        </div>
      </section>

      <section id="vip" className="macro-vip-section" aria-labelledby="vip-title">
        <div className="macro-vip-mark"><ShieldCheck size={19} /></div>
        <div className="macro-vip-copy"><span className="eyebrow">MACROLYNC / VIP</span><h2 id="vip-title">VIP Macro Pass</h2><p>Premium macro alerts and expanded COT breakdowns, billed monthly through Paystack.</p><div className="macro-vip-includes"><span><Check size={13} /> Event-driven macro alerts</span><span><Check size={13} /> Extended positioning notes</span></div></div>
        <form className="macro-vip-form" onSubmit={beginVipCheckout}>
          <div className="macro-vip-price"><strong className="mono">₦{new Intl.NumberFormat('en-NG').format(vipPrice)}</strong><span>/ month</span></div>
          <label htmlFor="vip-email">EMAIL FOR SUBSCRIPTION</label>
          <div className="macro-vip-email"><Mail size={15} /><input id="vip-email" type="email" autoComplete="email" required readOnly={Boolean(signedInEmail)} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></div>
          <button type="submit" className="macro-vip-button" disabled={!vipEnabled || checkoutBusy}>{checkoutBusy ? 'Opening Paystack…' : vipEnabled ? 'Subscribe with Paystack' : 'Checkout not configured'}<ArrowRight size={15} /></button>
          <p className="macro-vip-feedback" role="status">{checkoutMessage || (vipEnabled ? 'Secure checkout · recurring plan' : 'Configure Paystack secret and monthly plan to enable checkout.')}</p>
        </form>
      </section>

      <footer className="macro-footer">
        <div><Link className="macro-footer-brand" href="/"><span>Macro<span>Lync</span></span><small>GLOBAL FX INTELLIGENCE</small></Link><p>Independent macro research tooling. Not investment advice.</p></div>
        <div className="macro-footer-actions"><a href="mailto:fidulync@gmail.com"><Mail size={15} /> fidulync@gmail.com</a><a href="https://wa.me/2348037212445?text=Hello%2C%20I%27d%20like%20to%20automate%20a%20macro%20strategy%20with%20an%20MT5%20Expert%20Advisor." target="_blank" rel="noreferrer"><MessageCircle size={15} /> Automate this strategy <ArrowUpRight size={13} /></a></div>
        <span className="macro-footer-legal mono">RESEARCH TOOLING / NOT FINANCIAL ADVICE</span>
      </footer>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      {accessToken && <MacroAccountModal isOpen={accountOpen} accessToken={accessToken} onClose={() => setAccountOpen(false)} onSignOut={() => { setAccessToken(''); setSignedInEmail(''); }} />}
    </div>
  );
}
