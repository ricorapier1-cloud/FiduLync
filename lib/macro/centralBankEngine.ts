import type { MacroSnapshot } from '@/types/macro';

export type CentralBankDetails = {
  currency: string;
  bankName: string;
  governor: string;
  currentRate: number;
  previousRate: number;
  rateDeltaBps: number;
  nextMeetingDateUtc: string;
  stance: 'RESTRICTIVE' | 'HAWKISH' | 'NEUTRAL' | 'DOVISH' | 'ACCOMMODATIVE';
  balanceSheetPosture: 'QT' | 'NEUTRAL' | 'QE';
  twoYearYieldPct: number | null;
  tenYearYieldPct: number | null;
  yieldCurveSpreadBps: number | null;
  marketPricingExpectation: string; // e.g., "OIS pricing: 25 bps cut priced by Q1 2027 (simulated reference; live OIS feed unconfigured)"
  oisFeedConnected: boolean;
};

export const CENTRAL_BANK_METADATA: Record<string, Omit<CentralBankDetails, 'currentRate' | 'twoYearYieldPct'>> = {
  USD: {
    currency: 'USD',
    bankName: 'Federal Reserve',
    governor: 'Jerome Powell',
    previousRate: 5.0,
    rateDeltaBps: -25,
    nextMeetingDateUtc: '2026-12-16T19:00:00Z',
    stance: 'RESTRICTIVE',
    balanceSheetPosture: 'QT',
    tenYearYieldPct: 4.45,
    yieldCurveSpreadBps: 17,
    marketPricingExpectation: 'OIS pricing unconfigured. Federal funds futures imply steady policy pause at 4.50-4.75% range.',
    oisFeedConnected: false,
  },
  EUR: {
    currency: 'EUR',
    bankName: 'European Central Bank',
    governor: 'Christine Lagarde',
    previousRate: 3.5,
    rateDeltaBps: -25,
    nextMeetingDateUtc: '2026-12-17T13:15:00Z',
    stance: 'DOVISH',
    balanceSheetPosture: 'QT',
    tenYearYieldPct: 2.38,
    yieldCurveSpreadBps: 28,
    marketPricingExpectation: 'Deposit facility rate at 3.25%. OIS forward curve indicates continued easing bias toward 2.25% neutral.',
    oisFeedConnected: false,
  },
  GBP: {
    currency: 'GBP',
    bankName: 'Bank of England',
    governor: 'Andrew Bailey',
    previousRate: 5.0,
    rateDeltaBps: -25,
    nextMeetingDateUtc: '2026-12-17T12:00:00Z',
    stance: 'RESTRICTIVE',
    balanceSheetPosture: 'QT',
    tenYearYieldPct: 4.45,
    yieldCurveSpreadBps: 25,
    marketPricingExpectation: 'Official Bank Rate 4.75%. Inflation persistence keeps BoE in cautious, quarterly reduction cadence.',
    oisFeedConnected: false,
  },
  JPY: {
    currency: 'JPY',
    bankName: 'Bank of Japan',
    governor: 'Kazuo Ueda',
    previousRate: 0.1,
    rateDeltaBps: 15,
    nextMeetingDateUtc: '2026-12-19T03:00:00Z',
    stance: 'HAWKISH',
    balanceSheetPosture: 'NEUTRAL',
    tenYearYieldPct: 1.07,
    yieldCurveSpreadBps: 62,
    marketPricingExpectation: 'Overnight call rate target 0.25%. JGB normalization and wage momentum point toward 0.50% terminal by mid-2027.',
    oisFeedConnected: false,
  },
  CHF: {
    currency: 'CHF',
    bankName: 'Swiss National Bank',
    governor: 'Martin Schlegel',
    previousRate: 1.25,
    rateDeltaBps: -25,
    nextMeetingDateUtc: '2026-12-10T08:30:00Z',
    stance: 'ACCOMMODATIVE',
    balanceSheetPosture: 'NEUTRAL',
    tenYearYieldPct: 0.42,
    yieldCurveSpreadBps: 12,
    marketPricingExpectation: 'SNB policy rate 1.00%. Sub-1% domestic inflation permits defensive currency intervention if CHF spikes.',
    oisFeedConnected: false,
  },
  CAD: {
    currency: 'CAD',
    bankName: 'Bank of Canada',
    governor: 'Tiff Macklem',
    previousRate: 4.25,
    rateDeltaBps: -50,
    nextMeetingDateUtc: '2026-12-11T14:45:00Z',
    stance: 'DOVISH',
    balanceSheetPosture: 'NEUTRAL',
    tenYearYieldPct: 3.25,
    yieldCurveSpreadBps: 22,
    marketPricingExpectation: 'Target for overnight rate 3.75%. Weak domestic per-capita GDP supports dovish terminal rate expectation.',
    oisFeedConnected: false,
  },
  AUD: {
    currency: 'AUD',
    bankName: 'Reserve Bank of Australia',
    governor: 'Michele Bullock',
    previousRate: 4.35,
    rateDeltaBps: 0,
    nextMeetingDateUtc: '2026-12-10T03:30:00Z',
    stance: 'RESTRICTIVE',
    balanceSheetPosture: 'NEUTRAL',
    tenYearYieldPct: 4.52,
    yieldCurveSpreadBps: 48,
    marketPricingExpectation: 'Cash rate target 4.35%. Resilient services inflation keeps RBA on extended hold vs G10 peers.',
    oisFeedConnected: false,
  },
  NZD: {
    currency: 'NZD',
    bankName: 'Reserve Bank of New Zealand',
    governor: 'Adrian Orr',
    previousRate: 5.25,
    rateDeltaBps: -50,
    nextMeetingDateUtc: '2027-02-18T01:00:00Z',
    stance: 'DOVISH',
    balanceSheetPosture: 'NEUTRAL',
    tenYearYieldPct: 4.48,
    yieldCurveSpreadBps: 38,
    marketPricingExpectation: 'Official cash rate 4.75%. New Zealand economic contraction accelerates easing cycle.',
    oisFeedConnected: false,
  },
};

export function getCentralBankMonitors(snapshot: MacroSnapshot): CentralBankDetails[] {
  return Object.keys(CENTRAL_BANK_METADATA).map((code) => {
    const meta = CENTRAL_BANK_METADATA[code];
    const liveCcy = snapshot.currencies.find((c) => c.code === code);
    const currentRate = liveCcy?.policyRate ?? (code === 'USD' ? 4.75 : code === 'EUR' ? 3.25 : 4.0);
    const twoYearYield = liveCcy?.twoYearYield ?? null;
    const tenYearYield = meta.tenYearYieldPct;
    const yieldCurveSpreadBps = twoYearYield !== null && tenYearYield !== null
      ? Math.round((tenYearYield - twoYearYield) * 100)
      : meta.yieldCurveSpreadBps;

    return {
      ...meta,
      currentRate,
      twoYearYieldPct: twoYearYield,
      yieldCurveSpreadBps,
    };
  });
}
