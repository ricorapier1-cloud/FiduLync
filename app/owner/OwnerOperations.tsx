'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import OwnerControlPlane from './OwnerControlPlane';

type Props = { accessToken: string; email: string; role: string; onSignOut: () => void };
type Installation = { id: string; label: string; status: 'active' | 'revoked'; created_at: string; last_seen_at: string | null; broker: string | null; server: string | null };
type Overview = {
  generated_at: string;
  market_data: { active_installations: number; total_installations: number; latest_heartbeat: string | null; latest_heartbeat_age_seconds: number | null; latest_candle: { symbol: string; timeframe: string; bar_time: string; broker: string; server: string } | null; latest_candle_age_minutes: number | null; latest_quote: { symbol: string; quote_time: string; broker: string; server: string } | null; latest_quote_age_seconds: number | null };
  installations: Installation[];
  database: { reachable: boolean; installation_records: number };
  governance: { audit_log: string; multi_role_access: string; step_up_authentication: string; model_validation_registry: string; portfolio_risk_telemetry: string };
};
type ModuleId = 'overview' | 'governance' | 'market' | 'research' | 'risk' | 'security' | 'reliability';

const modules: { id: ModuleId; label: string; short: string; description: string }[] = [
  { id: 'overview', label: 'Command overview', short: 'Overview', description: 'Operational posture and critical exceptions' },
  { id: 'governance', label: 'Platform governance', short: 'Governance', description: 'Identity, privileged access and platform policy' },
  { id: 'market', label: 'Market data operations', short: 'Market data', description: 'Broker connectors, freshness and feed integrity' },
  { id: 'research', label: 'Quant research oversight', short: 'Quant research', description: 'Model provenance, validation and release controls' },
  { id: 'risk', label: 'Risk control centre', short: 'Risk controls', description: 'Risk policy, exposure visibility and fail-safe controls' },
  { id: 'security', label: 'Security and audit', short: 'Security', description: 'Authentication, credential lifecycle and accountability' },
  { id: 'reliability', label: 'System reliability', short: 'Reliability', description: 'Service health, data pipeline and release readiness' },
];

function formatTime(value: string | null | undefined) {
  if (!value) return 'Not yet observed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid timestamp' : date.toLocaleString();
}
function ageLabel(minutes: number | null) {
  if (minutes === null) return 'No candle received';
  if (minutes < 60) return minutes + ' min ago';
  if (minutes < 1440) return (minutes / 60).toFixed(1) + ' hours ago';
  return (minutes / 1440).toFixed(1) + ' days ago';
}
function Status({ tone = 'neutral', children }: { tone?: 'good' | 'warn' | 'neutral' | 'bad'; children: React.ReactNode }) {
  const styles = { good: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', warn: 'border-amber-300/20 bg-amber-300/10 text-amber-100', neutral: 'border-white/10 bg-white/[0.04] text-slate-300', bad: 'border-rose-400/20 bg-rose-400/10 text-rose-200' };
  return <span className={'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ' + styles[tone]}>{children}</span>;
}
function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'good' | 'warn' | 'neutral' | 'bad' }) {
  return <div className="rounded-xl border border-white/[0.09] bg-[#0a1017] p-4"><div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-3 break-words text-xl font-semibold tracking-tight text-slate-100">{value}</div><div className="mt-2 text-[11px] leading-5 text-slate-500">{detail}</div><div className="mt-3"><Status tone={tone}>{tone === 'good' ? 'Verified' : tone === 'warn' ? 'Attention' : tone === 'bad' ? 'Exception' : 'Status'}</Status></div></div>;
}
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.09] bg-[#0c131c] p-5 sm:p-6"><div className="mb-5"><h2 className="text-base font-semibold text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>{children}</section>;
}
function ReadinessRow({ label, value, note, tone = 'warn' }: { label: string; value: string; note: string; tone?: 'good' | 'warn' | 'neutral' | 'bad' }) {
  return <div className="flex flex-col gap-2 border-b border-white/[0.06] py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-medium text-slate-200">{label}</div><div className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">{note}</div></div><Status tone={tone}>{value}</Status></div>;
}

export default function OwnerOperations({ accessToken, email, role, onSignOut }: Props) {
  const [active, setActive] = useState<ModuleId>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('Primary MT5 terminal');
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      const response = await fetch('/api/owner/operations', { headers: { Authorization: 'Bearer ' + accessToken }, cache: 'no-store' });
      const result = await response.json() as Overview & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to load operations overview.');
      setOverview(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Operations overview unavailable.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [accessToken]);

  useEffect(() => { const task = Promise.resolve().then(() => refresh()); return () => { void task; }; }, [refresh]);

  const activeModule = useMemo(() => modules.find((item) => item.id === active) ?? modules[0], [active]);
  const market = overview?.market_data;
  const quoteAgeSeconds = market?.latest_quote_age_seconds ?? null;
  const quoteFresh = quoteAgeSeconds !== null && quoteAgeSeconds <= 120;
  const heartbeatFresh = market?.latest_heartbeat_age_seconds !== null && market?.latest_heartbeat_age_seconds !== undefined && market.latest_heartbeat_age_seconds <= 180;
  const candleAgeMinutes = market?.latest_candle_age_minutes ?? null;
  const candleTimeframe = market?.latest_candle?.timeframe;
  const candleFresh = candleAgeMinutes !== null && candleAgeMinutes <= (candleTimeframe === 'H1' ? 480 : candleTimeframe === 'H4' ? 2160 : 7200);

  async function createConnector() {
    setCreating(true); setToken(''); setNotice('');
    try {
      const response = await fetch('/api/mt5/installations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken }, body: JSON.stringify({ label }) });
      const result = await response.json() as { token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error || 'Connector could not be created.');
      setToken(result.token);
      setNotice('Connector credential created. Copy it now; it is displayed only once.');
      await refresh(true);
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Connector creation failed.'); }
    finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this installation now? Future uploads from it will be rejected.')) return;
    try {
      const response = await fetch('/api/mt5/installations', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken }, body: JSON.stringify({ installation_id: id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Revocation failed.');
      setNotice('Connector revoked.');
      await refresh(true);
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Revocation failed.'); }
  }

  return <main className="mx-auto min-h-[75vh] w-full max-w-7xl px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
    <OwnerControlPlane accessToken={accessToken} />
    <header className="mb-6 flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="font-mono text-[9px] tracking-[0.22em] text-emerald-300">FIDULYNC / INSTITUTIONAL OPERATIONS</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Governance & control centre</h1><p className="mt-2 max-w-2xl text-xs leading-6 text-slate-400">A private control plane for platform integrity, market-data operations, research governance and risk oversight.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Status tone="good">Owner identity verified</Status><button onClick={() => void refresh()} disabled={refreshing} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh data'}</button><button onClick={onSignOut} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Sign out</button></div>
    </header>
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/[0.08] bg-[#0c131c] px-4 py-3 text-[10px] text-slate-400"><span>OWNER <b className="ml-1 text-slate-200">{email}</b></span><span>ROLE <b className="ml-1 text-emerald-200">{role.toUpperCase()}</b></span><span>SUPPORT <b className="ml-1 text-slate-200">fidulync@gmail.com</b></span><span className="sm:ml-auto">Updated {overview ? formatTime(overview.generated_at) : '—'}</span></div>
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Owner operations modules" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {modules.map((item) => <button key={item.id} onClick={() => setActive(item.id)} aria-current={active === item.id ? 'page' : undefined} className={'min-w-max rounded-xl border px-3 py-3 text-left transition-colors lg:min-w-0 ' + (active === item.id ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100' : 'border-white/[0.07] bg-[#0b1118] text-slate-400 hover:border-white/20 hover:text-slate-200')}><span className="block text-xs font-semibold">{item.short}</span><span className="mt-1 hidden text-[10px] leading-4 text-slate-500 lg:block">{item.description}</span></button>)}
        <div className="hidden rounded-xl border border-white/[0.07] bg-[#0b1118] p-3 text-[10px] leading-5 text-slate-500 lg:block">Customer product access is separate from this private owner control plane. Administrative access does not override trading or risk eligibility checks.</div>
      </nav>
      <div className="min-w-0 space-y-5">
        <div><div className="text-[9px] font-medium uppercase tracking-[0.18em] text-emerald-300">{activeModule.label}</div><p className="mt-1 text-xs text-slate-500">{activeModule.description}</p></div>
        {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-xs text-rose-100">{error}</div>}
        {loading && !overview ? <div className="rounded-xl border border-white/[0.08] bg-[#0c131c] p-8 text-center text-xs text-slate-400">Loading verified operations data…</div> : null}

        {active === 'overview' && overview && <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Database" value={overview.database.reachable ? 'Reachable' : 'Unavailable'} detail="Authenticated server-side connectivity check" tone={overview.database.reachable ? 'good' : 'bad'} /><Metric label="Active MT5 installs" value={String(market?.active_installations ?? 0)} detail="Owner-linked, non-revoked connector credentials" tone={(market?.active_installations ?? 0) > 0 ? 'good' : 'warn'} /><Metric label="Latest quote" value={market?.latest_quote ? ageLabel(Math.round((market.latest_quote_age_seconds ?? 0) / 60)) : 'Not received'} detail={market?.latest_quote ? market.latest_quote.symbol + ' · ' + market.latest_quote.broker : 'No broker quote has reached the platform'} tone={quoteFresh ? 'good' : 'warn'} /><Metric label="Latest candle" value={ageLabel(market?.latest_candle_age_minutes ?? null)} detail={market?.latest_candle ? market.latest_candle.symbol + ' ' + market.latest_candle.timeframe + ' · ' + market.latest_candle.broker : 'No MT5 candle has been ingested'} tone={candleFresh ? 'good' : 'warn'} /></div>
          <Panel title="Operational exceptions" subtitle="Only observed system facts are shown. Missing integrations are not treated as healthy.">
            <ReadinessRow label="MT5 terminal heartbeat" value={heartbeatFresh ? 'Recent' : 'Not verified'} note={'Most recent owner connector heartbeat: ' + formatTime(market?.latest_heartbeat)} tone={heartbeatFresh ? 'good' : 'warn'} />
            <ReadinessRow label="Live broker quote" value={quoteFresh ? 'Fresh quote observed' : 'No fresh quote'} note={market?.latest_quote ? market.latest_quote.symbol + ' quote timestamp: ' + formatTime(market.latest_quote.quote_time) : 'Connect an MT5 terminal to provide broker bid/ask observations.'} tone={quoteFresh ? 'good' : 'warn'} />
            <ReadinessRow label="Model validation registry" value="Not connected" note="No signed model approval, walk-forward evidence or release registry is currently exposed in this console." />
            <ReadinessRow label="Portfolio risk telemetry" value="Not connected" note="No verified account equity, positions, margin or portfolio exposure stream is currently connected." />
            <ReadinessRow label="Tamper-evident audit trail" value="Not configured" note="Administrative actions are not yet written to a dedicated immutable audit ledger." />
          </Panel>
        </div>}

        {active === 'governance' && <Panel title="Platform governance" subtitle="Least-privilege administration. Privileged roles are not fabricated before their authorization controls exist.">
          <ReadinessRow label="Primary owner" value="Verified" note={email + ' is the sole configured owner identity.'} tone="good" />
          <ReadinessRow label="Customer support identity" value="Separate" note="fidulync@gmail.com remains the customer-facing support address." tone="good" />
          <ReadinessRow label="Role-based access control" value="Owner-only" note="Quant researcher, risk officer, operations and auditor roles are future roles; no extra accounts are implicitly trusted." />
          <ReadinessRow label="Public owner registration" value="Not exposed" note="Owner verification is performed server-side against the configured owner email." tone="good" />
          <ReadinessRow label="Customer / control-plane separation" value="Required boundary" note="This console must not expose customer credentials or bypass customer-level entitlements." tone="good" />
        </Panel>}

        {active === 'market' && <div className="space-y-5">
          <Panel title="MT5 broker data operations" subtitle="Per-terminal credentials, broker metadata, quote freshness and ingestion status.">
            <div className="grid gap-3 sm:grid-cols-3"><Metric label="Active installs" value={String(market?.active_installations ?? 0)} detail="Currently accepted connector credentials" tone={(market?.active_installations ?? 0) ? 'good' : 'warn'} /><Metric label="Latest quote age" value={market?.latest_quote_age_seconds === null || market?.latest_quote_age_seconds === undefined ? '—' : market.latest_quote_age_seconds + ' sec'} detail={market?.latest_quote?.symbol ?? 'No quote symbol'} tone={quoteFresh ? 'good' : 'warn'} /><Metric label="Latest bar age" value={ageLabel(market?.latest_candle_age_minutes ?? null)} detail={market?.latest_candle ? market.latest_candle.symbol + ' ' + market.latest_candle.timeframe : 'No candle data'} tone={candleFresh ? 'good' : 'warn'} /></div>
            <div className="mt-5 space-y-3"><label className="block text-[11px] text-slate-400" htmlFor="mt5-label">New terminal label</label><div className="flex flex-col gap-2 sm:flex-row"><input id="mt5-label" value={label} onChange={(event) => setLabel(event.target.value.slice(0, 80))} maxLength={80} className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-emerald-300/40" /><button onClick={() => void createConnector()} disabled={creating || !label.trim()} className="rounded-lg bg-emerald-300 px-4 py-3 text-xs font-semibold text-[#07120d] disabled:opacity-50">{creating ? 'Creating…' : 'Issue one-time connector token'}</button></div>
            {token && <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">One-time secret · copy now</div><code className="mt-2 block break-all text-xs text-amber-50">{token}</code><button onClick={() => void navigator.clipboard.writeText(token)} className="mt-3 rounded-lg border border-amber-200/20 px-3 py-2 text-[11px] text-amber-100">Copy token</button><p className="mt-2 text-[10px] text-amber-200/80">The server stores only its hash. It cannot be displayed again.</p></div>}
            {notice && <p role="status" className="text-xs text-slate-300">{notice}</p>}
            </div>
          </Panel>
          <Panel title="Registered terminal installations" subtitle="Revoke any terminal whose token may have been exposed or is no longer trusted.">
            <div className="space-y-3">{overview?.installations.length ? overview.installations.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-100">{item.label}<Status tone={item.status === 'active' ? 'good' : 'neutral'}>{item.status}</Status></div><p className="mt-1 break-words text-[10px] leading-5 text-slate-500">{item.broker || 'Broker pending'} · {item.server || 'Server pending'}</p><p className="text-[10px] text-slate-500">Last seen: {formatTime(item.last_seen_at)}</p></div>{item.status === 'active' && <button onClick={() => void revoke(item.id)} className="self-start rounded-lg border border-rose-300/20 px-3 py-2 text-[10px] text-rose-200 hover:bg-rose-300/5">Revoke access</button>}</div>) : <p className="text-xs text-slate-500">No MT5 installations are registered.</p>}</div>
          </Panel>
        </div>}

        {active === 'research' && <Panel title="Quant research oversight" subtitle="Research outputs must be traceable, reproducible and independently validated before release.">
          <ReadinessRow label="Technical research engine" value="Code integrated" note="MacroLync technical indicators and regime features are implemented in the application; code presence alone is not evidence of predictive performance." tone="good" />
          <ReadinessRow label="Live market data provenance" value={market?.latest_candle ? 'Broker observation received' : 'Not connected'} note={'Latest candle: ' + (market?.latest_candle ? formatTime(market.latest_candle.bar_time) + ' · ' + market.latest_candle.broker + '/' + market.latest_candle.server : 'No MT5 observations are available.')} tone={market?.latest_candle ? 'good' : 'warn'} />
          <ReadinessRow label="Model version registry" value="Not connected" note="Versioned model manifests, parameter hashes and approval signatures are not yet surfaced here." />
          <ReadinessRow label="Walk-forward / out-of-sample evidence" value="Not verified" note="No signed validation reports are attached to this console. Do not market model accuracy until evidence exists." />
          <ReadinessRow label="Independent data checks" value="Required" note="Broker-specific FX prices are not a consolidated market feed; compare independent sources and preserve source provenance." />
        </Panel>}

        {active === 'risk' && <Panel title="Risk control centre" subtitle="The control plane can restrict system eligibility; it must never force a trade or bypass a risk gate.">
          <ReadinessRow label="Execution eligibility" value="Fail-closed principle" note="Missing or stale market data must result in unavailable execution eligibility, not a fabricated green status." tone="good" />
          <ReadinessRow label="Portfolio exposure / margin" value="Not connected" note="No live account equity, open positions, leverage, margin level or cross-account exposure telemetry is currently connected." />
          <ReadinessRow label="Drawdown and loss limits" value="Not centrally verified" note="A central risk register and runtime telemetry are not yet exposed to this owner console." />
          <ReadinessRow label="Emergency execution disable" value="Not implemented here" note="No dashboard switch is presented until a server-enforced, audited kill control is implemented end-to-end." />
          <ReadinessRow label="Administrative override" value="Prohibited" note="Owner access must not override SL/TP, margin checks, exposure caps, signal quality gates or account risk constraints." tone="good" />
        </Panel>}

        {active === 'security' && <Panel title="Security and audit" subtitle="Privileged access must be authenticated server-side, attributable and reviewable.">
          <ReadinessRow label="Owner identity check" value="Verified per API request" note={'Authenticated owner: ' + email} tone="good" />
          <ReadinessRow label="Connector secret storage" value="SHA-256 hash only" note="MT5 installation credentials are returned once and stored as hashes; individual installations can be revoked." tone="good" />
          <ReadinessRow label="Customer credentials" value="Not exposed" note="No MT5 account passwords or broker trading credentials are requested by the data-only connector." tone="good" />
          <ReadinessRow label="Dedicated audit ledger" value="Not configured" note="A tamper-evident record of sign-ins, connector creation/revocation, policy changes and privileged reads is still required." />
          <ReadinessRow label="MFA / step-up verification" value="Email OTP only" note="The current owner sign-in uses passwordless email OTP. Passkeys or stronger step-up authentication are not yet configured." tone="warn" />
          <ReadinessRow label="Dual approval" value="Not configured" note="For future high-impact actions, require independent approval rather than a single administrator self-approving." />
        </Panel>}

        {active === 'reliability' && <Panel title="System reliability" subtitle="Live status is reported only for dependencies that this console actually probes.">
          <ReadinessRow label="Supabase server connectivity" value={overview?.database.reachable ? 'Reachable' : 'Unavailable'} note="Authenticated server-side database query completed." tone={overview?.database.reachable ? 'good' : 'bad'} />
          <ReadinessRow label="MT5 ingestion pipeline" value={market?.active_installations ? 'Connector configured' : 'Awaiting terminal'} note={market?.active_installations ? market.active_installations + ' active connector(s); a live heartbeat and fresh quotes are separately required.' : 'No active MT5 connector installation is registered.'} tone={market?.active_installations ? 'good' : 'warn'} />
          <ReadinessRow label="Latest market quote" value={quoteFresh ? 'Fresh' : 'Stale / absent'} note={market?.latest_quote ? formatTime(market.latest_quote.quote_time) + ' · ' + market.latest_quote.symbol : 'No quote record exists.'} tone={quoteFresh ? 'good' : 'warn'} />
          <ReadinessRow label="Deployment health" value="Not probed" note="Vercel deployment state and production commit are not yet wired into this console." />
          <ReadinessRow label="Background jobs / alert delivery" value="Not probed" note="No verified scheduler, alert delivery or incident notification status is currently exposed." />
        </Panel>}

        <footer className="flex flex-col gap-1 border-t border-white/[0.07] pt-4 text-[10px] leading-5 text-slate-600 sm:flex-row sm:justify-between"><span>FiduLync private control plane · No trading authority granted</span><span>Operational facts refreshed on demand · Not an investment-performance certification</span></footer>
      </div>
    </div>
  </main>;
}
