/**
 * Multi-account, multi-EA portfolio risk aggregation.
 *
 * Cash risk is kept isolated by MT5 account and account currency. Native
 * currency exposure can be aggregated by currency, but is not converted into
 * account-currency risk. Missing stops/specifications or incomplete snapshots
 * degrade the result; they are never silently treated as zero risk.
 */

export type PortfolioPositionInput = {
  installationId: string;
  accountLogin: number;
  accountCurrency: string;
  snapshotAt: string;
  snapshotComplete: boolean;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  stopLoss: number;
  tickSize: number;
  tickValueLoss: number;
  contractSize: number;
  baseCurrency: string | null;
  quoteCurrency: string | null;
};

export type PortfolioAccountInput = {
  installationId: string;
  accountLogin: number;
  accountCurrency: string;
  equity: number;
  reportedOpenRiskCash: number;
  reportedOpenRiskVerified: boolean;
  accountSnapshotAt: string;
  positionSnapshotAt: string;
  expectedPositions: number;
  positions: PortfolioPositionInput[];
  manifestComplete: boolean;
};

export type PortfolioRiskPolicy = {
  maxPortfolioRiskPct: number;
  maxSnapshotAgeMs: number;
  reconciliationTolerancePct: number;
};

export type PortfolioRiskResult = {
  status: 'READY' | 'DEGRADED' | 'UNAVAILABLE';
  generatedAt: string;
  accountCount: number;
  positionCount: number;
  protectedPositionCount: number;
  unprotectedPositionCount: number;
  accounts: Array<{
    accountKey: string;
    currency: string;
    equity: number;
    openRiskCash: number | null;
    openRiskPct: number | null;
    reportedOpenRiskCash: number | null;
    calculatedOpenRiskCash: number | null;
    riskVerified: boolean;
    positionCount: number;
    unprotectedPositionCount: number;
    snapshotAgeMs: number | null;
    blockers: string[];
  }>;
  currencyExposures: Array<{ currency: string; netUnits: number; grossUnits: number }>;
  blockers: string[];
};

const DEFAULT_POLICY: PortfolioRiskPolicy = {
  maxPortfolioRiskPct: 2,
  maxSnapshotAgeMs: 30_000,
  reconciliationTolerancePct: 5,
};

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
const accountKey = (installationId: string, accountLogin: number) => `${installationId}:${accountLogin}`;

export function aggregatePortfolioRisk(
  inputs: PortfolioAccountInput[],
  now = Date.now(),
  policy: PortfolioRiskPolicy = DEFAULT_POLICY,
): PortfolioRiskResult {
  const blockers: string[] = [];
  const currencyTotals = new Map<string, { netUnits: number; grossUnits: number }>();
  const accounts: PortfolioRiskResult['accounts'] = [];
  let positionCount = 0;
  let protectedPositionCount = 0;
  let unprotectedPositionCount = 0;

  if (!Number.isFinite(now) || !finitePositive(policy.maxPortfolioRiskPct)
    || !finitePositive(policy.maxSnapshotAgeMs)
    || !Number.isFinite(policy.reconciliationTolerancePct)
    || policy.reconciliationTolerancePct < 0) {
    return {
      status: 'UNAVAILABLE', generatedAt: new Date().toISOString(), accountCount: 0,
      positionCount: 0, protectedPositionCount: 0, unprotectedPositionCount: 0,
      accounts: [], currencyExposures: [], blockers: ['INVALID_AGGREGATION_POLICY_OR_CLOCK'],
    };
  }

  const seenAccounts = new Set<string>();
  for (const account of inputs) {
    const key = accountKey(account.installationId, account.accountLogin);
    if (seenAccounts.has(key)) {
      blockers.push('DUPLICATE_ACCOUNT_SNAPSHOT');
      continue;
    }
    seenAccounts.add(key);

    const accountBlockers: string[] = [];
    const accountTime = Date.parse(account.accountSnapshotAt);
    const positionTime = Date.parse(account.positionSnapshotAt);
    const accountAge = now - accountTime;
    const positionAge = now - positionTime;
    const snapshotAgeMs = Number.isFinite(accountAge) && Number.isFinite(positionAge)
      ? Math.max(accountAge, positionAge) : null;
    if (!account.manifestComplete) accountBlockers.push('POSITION_MANIFEST_INCOMPLETE');
    if (account.expectedPositions !== account.positions.length) accountBlockers.push('POSITION_COUNT_MISMATCH');
    if (!finitePositive(account.equity)) accountBlockers.push('ACCOUNT_EQUITY_UNAVAILABLE');
    if (!account.reportedOpenRiskVerified || !Number.isFinite(account.reportedOpenRiskCash)
      || account.reportedOpenRiskCash < 0) accountBlockers.push('BROKER_OPEN_RISK_UNVERIFIED');
    if (snapshotAgeMs === null || accountAge < 0 || positionAge < 0
      || accountAge > policy.maxSnapshotAgeMs || positionAge > policy.maxSnapshotAgeMs) {
      accountBlockers.push('ACCOUNT_OR_POSITION_SNAPSHOT_STALE');
    }
    if (Number.isFinite(accountTime) && Number.isFinite(positionTime)
      && Math.abs(accountTime - positionTime) > 5_000) accountBlockers.push('ACCOUNT_POSITION_SNAPSHOT_MISALIGNED');

    let calculatedRisk = 0;
    let calculatedRiskComplete = true;
    let unprotected = 0;
    for (const position of account.positions) {
      positionCount += 1;
      if (!position.snapshotComplete) {
        calculatedRiskComplete = false;
        accountBlockers.push('POSITION_ROW_NOT_COMPLETE');
      }
      if (position.installationId !== account.installationId
        || position.accountLogin !== account.accountLogin
        || position.accountCurrency !== account.accountCurrency) {
        calculatedRiskComplete = false;
        accountBlockers.push('POSITION_ACCOUNT_IDENTITY_MISMATCH');
      }

      const sideSign = position.side === 'BUY' ? 1 : position.side === 'SELL' ? -1 : 0;
      const validPosition = sideSign !== 0 && finitePositive(position.volume)
        && finitePositive(position.entryPrice) && finitePositive(position.contractSize);
      if (!validPosition) {
        calculatedRiskComplete = false;
        unprotected += 1;
        continue;
      }

      const base = position.baseCurrency?.toUpperCase();
      const quote = position.quoteCurrency?.toUpperCase();
      if (base && quote && /^[A-Z]{3}$/.test(base) && /^[A-Z]{3}$/.test(quote)) {
        const baseUnits = position.volume * position.contractSize;
        const quoteUnits = baseUnits * position.entryPrice;
        for (const [currency, signedUnits] of [[base, sideSign * baseUnits], [quote, -sideSign * quoteUnits]] as const) {
          const total = currencyTotals.get(currency) ?? { netUnits: 0, grossUnits: 0 };
          total.netUnits += signedUnits;
          total.grossUnits += Math.abs(signedUnits);
          currencyTotals.set(currency, total);
        }
      } else {
        accountBlockers.push('CURRENCY_EXPOSURE_METADATA_MISSING');
      }

      const stopDirectionValid = position.side === 'BUY'
        ? position.stopLoss > 0 && position.stopLoss < position.entryPrice
        : position.stopLoss > position.entryPrice;
      const riskInputsValid = stopDirectionValid && finitePositive(position.tickSize)
        && finitePositive(position.tickValueLoss);
      if (!riskInputsValid) {
        calculatedRiskComplete = false;
        unprotected += 1;
        continue;
      }
      const stopTicks = Math.abs(position.entryPrice - position.stopLoss) / position.tickSize;
      const positionRisk = stopTicks * position.tickValueLoss * position.volume;
      if (!finitePositive(positionRisk)) {
        calculatedRiskComplete = false;
        unprotected += 1;
        continue;
      }
      calculatedRisk += positionRisk;
      protectedPositionCount += 1;
    }

    unprotectedPositionCount += unprotected;
    const reportedRisk = account.reportedOpenRiskVerified && Number.isFinite(account.reportedOpenRiskCash)
      ? account.reportedOpenRiskCash : null;
    const riskDifferencePct = reportedRisk !== null && reportedRisk > 0
      ? Math.abs(calculatedRisk - reportedRisk) / reportedRisk * 100
      : reportedRisk === 0 && calculatedRisk === 0 ? 0 : null;
    if (riskDifferencePct !== null && riskDifferencePct > policy.reconciliationTolerancePct) {
      accountBlockers.push('BROKER_AND_POSITION_RISK_MISMATCH');
    }
    if (unprotected > 0) accountBlockers.push('UNPROTECTED_OR_UNMEASURABLE_POSITION');
    if (!calculatedRiskComplete) accountBlockers.push('CALCULATED_POSITION_RISK_INCOMPLETE');

    const riskVerified = accountBlockers.length === 0 && reportedRisk !== null;
    const openRiskCash = riskVerified ? reportedRisk : null;
    const openRiskPct = openRiskCash !== null && finitePositive(account.equity)
      ? openRiskCash / account.equity * 100 : null;
    if (openRiskPct !== null && openRiskPct > policy.maxPortfolioRiskPct) {
      accountBlockers.push('PORTFOLIO_RISK_LIMIT_EXCEEDED');
    }

    accounts.push({
      accountKey: key,
      currency: account.accountCurrency,
      equity: finitePositive(account.equity) ? account.equity : 0,
      openRiskCash,
      openRiskPct,
      reportedOpenRiskCash: reportedRisk,
      calculatedOpenRiskCash: calculatedRiskComplete ? calculatedRisk : null,
      riskVerified: riskVerified && (openRiskPct === null || openRiskPct <= policy.maxPortfolioRiskPct),
      positionCount: account.positions.length,
      unprotectedPositionCount: unprotected,
      snapshotAgeMs,
      blockers: [...new Set(accountBlockers)],
    });
    blockers.push(...accountBlockers);
  }

  if (inputs.length === 0) blockers.push('NO_VERIFIED_MT5_ACCOUNT_SNAPSHOTS');
  const currencyExposures = [...currencyTotals.entries()]
    .map(([currency, values]) => ({ currency, netUnits: values.netUnits, grossUnits: values.grossUnits }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const status = inputs.length === 0 ? 'UNAVAILABLE' : blockers.length ? 'DEGRADED' : 'READY';

  return {
    status,
    generatedAt: new Date(now).toISOString(),
    accountCount: accounts.length,
    positionCount,
    protectedPositionCount,
    unprotectedPositionCount,
    accounts,
    currencyExposures,
    blockers: [...new Set(blockers)],
  };
}
