import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';
import { getPersonalRiskPolicy } from '@/lib/riskPolicy';
import { aggregatePortfolioRisk, type PortfolioAccountInput, type PortfolioPositionInput } from '@/lib/portfolioRisk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InstallationRow = { id: string };
type ManifestRow = {
  installation_id: string; account_login: number; snapshot_id: string;
  captured_at: string; expected_positions: number; complete: boolean;
};
type AccountRow = {
  installation_id: string; account_login: number; currency: string; equity: number;
  open_risk_cash: number; open_risk_verified: boolean; captured_at: string;
};
type PositionRow = {
  installation_id: string; account_login: number; snapshot_id: string; captured_at: string;
  snapshot_complete: boolean; symbol: string; side: string; volume: number;
  price_open: number; stop_loss: number; contract_size: number; tick_size: number;
  tick_value_loss: number; base_currency: string | null; quote_currency: string | null;
};

const keyOf = (installationId: string, accountLogin: number) => `${installationId}:${accountLogin}`;

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: 'Privileged portfolio access required.' }, {
      status: 401, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const rate = await enforceDistributedRateLimit(request, 'portfolio-risk-aggregation', 30, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Portfolio risk service is temporarily unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Portfolio risk request limit exceeded.' }, { status: 429 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: installations, error: installationError } = await supabase
      .from('mt5_installations')
      .select('id')
      .eq('user_id', owner.id)
      .eq('status', 'active')
      .limit(100);
    if (installationError) throw installationError;

    const installationIds = (installations ?? []).map((item: InstallationRow) => item.id);
    if (!installationIds.length) {
      const portfolio = aggregatePortfolioRisk([], Date.now(), {
        maxPortfolioRiskPct: getPersonalRiskPolicy().maxPortfolioRiskPct,
        maxSnapshotAgeMs: 30_000,
        reconciliationTolerancePct: 5,
      });
      return NextResponse.json({ portfolio, dataStatus: 'NO_ACTIVE_MT5_INSTALLATIONS' }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    const [manifestResult, accountResult] = await Promise.all([
      supabase.from('mt5_position_snapshot_manifests')
        .select('installation_id,account_login,snapshot_id,captured_at,expected_positions,complete')
        .in('installation_id', installationIds)
        .order('captured_at', { ascending: false })
        .limit(500),
      supabase.from('mt5_account_snapshots')
        .select('installation_id,account_login,currency,equity,open_risk_cash,open_risk_verified,captured_at')
        .in('installation_id', installationIds)
        .order('captured_at', { ascending: false })
        .limit(500),
    ]);
    if (manifestResult.error) throw manifestResult.error;
    if (accountResult.error) throw accountResult.error;

    const latestManifestByAccount = new Map<string, ManifestRow>();
    for (const row of (manifestResult.data ?? []) as ManifestRow[]) {
      const key = keyOf(row.installation_id, Number(row.account_login));
      if (!latestManifestByAccount.has(key)) latestManifestByAccount.set(key, row);
    }
    const latestAccountByKey = new Map<string, AccountRow>();
    for (const row of (accountResult.data ?? []) as AccountRow[]) {
      const key = keyOf(row.installation_id, Number(row.account_login));
      if (!latestAccountByKey.has(key)) latestAccountByKey.set(key, row);
    }

    const manifests = [...latestManifestByAccount.values()];
    const completeSnapshotIds = manifests.filter((row) => row.complete).map((row) => row.snapshot_id);
    const positionResult = completeSnapshotIds.length
      ? await supabase.from('mt5_open_position_snapshots')
        .select('installation_id,account_login,snapshot_id,captured_at,snapshot_complete,symbol,side,volume,price_open,stop_loss,contract_size,tick_size,tick_value_loss,base_currency,quote_currency')
        .in('snapshot_id', completeSnapshotIds)
        .limit(2500)
      : { data: [], error: null };
    if (positionResult.error) throw positionResult.error;
    const positionsBySnapshot = new Map<string, PositionRow[]>();
    for (const row of (positionResult.data ?? []) as PositionRow[]) {
      const rows = positionsBySnapshot.get(row.snapshot_id) ?? [];
      rows.push(row);
      positionsBySnapshot.set(row.snapshot_id, rows);
    }

    const positionQueryTruncated = (positionResult.data ?? []).length >= 2500;
    const accounts: PortfolioAccountInput[] = manifests.map((manifest) => {
      const account = latestAccountByKey.get(keyOf(manifest.installation_id, Number(manifest.account_login)));
      const rows = positionsBySnapshot.get(manifest.snapshot_id) ?? [];
      const positions: PortfolioPositionInput[] = rows.map((row) => ({
        installationId: row.installation_id,
        accountLogin: Number(row.account_login),
        accountCurrency: account?.currency ?? 'UNK',
        snapshotAt: row.captured_at,
        snapshotComplete: row.snapshot_complete === true,
        symbol: row.symbol,
        side: row.side === 'BUY' || row.side === 'SELL' ? row.side : 'BUY',
        volume: Number(row.volume),
        entryPrice: Number(row.price_open),
        stopLoss: Number(row.stop_loss),
        tickSize: Number(row.tick_size),
        tickValueLoss: Number(row.tick_value_loss),
        contractSize: Number(row.contract_size),
        baseCurrency: row.base_currency,
        quoteCurrency: row.quote_currency,
      }));
      return {
        installationId: manifest.installation_id,
        accountLogin: Number(manifest.account_login),
        accountCurrency: account?.currency ?? 'UNK',
        equity: account ? Number(account.equity) : Number.NaN,
        reportedOpenRiskCash: account ? Number(account.open_risk_cash) : Number.NaN,
        reportedOpenRiskVerified: account?.open_risk_verified === true,
        accountSnapshotAt: account?.captured_at ?? '',
        positionSnapshotAt: manifest.captured_at,
        expectedPositions: Number(manifest.expected_positions),
        positions,
        manifestComplete: manifest.complete === true && !positionQueryTruncated,
      };
    });

    const policy = getPersonalRiskPolicy();
    const portfolio = aggregatePortfolioRisk(accounts, Date.now(), {
      maxPortfolioRiskPct: policy.maxPortfolioRiskPct,
      maxSnapshotAgeMs: 30_000,
      reconciliationTolerancePct: 5,
    });
    return NextResponse.json({
      portfolio,
      dataStatus: portfolio.status,
      policy: {
        policyVersion: policy.policyVersion,
        maxPortfolioRiskPct: policy.maxPortfolioRiskPct,
        maxDailyDrawdownPct: policy.maxDailyDrawdownPct,
        maxWeeklyDrawdownPct: policy.maxWeeklyDrawdownPct,
        maxHighWaterDrawdownPct: policy.maxHighWaterDrawdownPct,
      },
      provenance: {
        source: 'MT5 authenticated publisher snapshots',
        generatedAt: portfolio.generatedAt,
        accountSnapshotMaxAgeMs: 30_000,
        positionManifestRequired: true,
        positionQueryTruncated,
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Portfolio risk aggregation failed:', error);
    return NextResponse.json({ error: 'Verified portfolio risk is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
