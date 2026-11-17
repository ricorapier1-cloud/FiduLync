export type EaProduct = {
  id: string;
  slug: string;
  name: string;
  version: string;
  badge: string;
  badgeColor: 'emerald' | 'cyan' | 'amber';
  headline: string;
  description: string;
  tierCategory: 'FLAGSHIP' | 'MOMENTUM' | 'SANDBOX';
  monthlyPriceNgn: number;
  monthlyPriceUsd: number;
  lifetimePriceNgn: number;
  lifetimePriceUsd: number;
  winRate: string;
  profitFactor: string;
  sharpeRatio: string;
  maxDrawdown: string;
  targetPairs: string;
  timeframe: string;
  demoDownloadUrl: string;
  demoFilename: string;
  mqhDownloadUrl: string;
  maxLiveAccounts: number;
  maxDemoAccounts: number;
  equityCurvePoints: number[];
  provenanceNote: string;
  artifactReady?: boolean;
};

export const EA_CATALOG: EaProduct[] = [
  {
    id: 'eridam-nexus',
    slug: 'eridam-nexus-pro',
    name: 'Eridam Nexus Adaptive Pro',
    version: 'v4.2',
    badge: 'FLAGSHIP INSTITUTIONAL',
    badgeColor: 'emerald',
    headline: 'Multi-Regime Volatility & Macro Bias Execution Engine',
    description:
      'Dynamically scales positioning based on real yield spreads and institutional liquidity killzones. Deploys non-martingale volatility-adjusted stop losses with ATR trailing protection.',
    tierCategory: 'FLAGSHIP',
    monthlyPriceNgn: 65000,
    monthlyPriceUsd: 49,
    lifetimePriceNgn: 250000,
    lifetimePriceUsd: 199,
    winRate: '64.8%',
    profitFactor: '2.34',
    sharpeRatio: '2.18',
    maxDrawdown: '5.4%',
    targetPairs: 'EURUSD · GBPUSD · USDJPY · XAUUSD',
    timeframe: 'H1 Signal / H4 Regime',
    demoDownloadUrl: '/downloads/Eridam_Nexus_Adaptive_Demo.mq5',
    demoFilename: 'Eridam_Nexus_Adaptive_Demo.mq5',
    mqhDownloadUrl: '/downloads/MacroLyncLicense.mqh',
    maxLiveAccounts: 1,
    maxDemoAccounts: 2,
    equityCurvePoints: [100, 102, 101, 105, 108, 107, 112, 116, 115, 121, 126, 124, 131, 138, 142],
    provenanceNote: 'Simulated institutional forward-test & historical sample reference.',
  },
  {
    id: 'velocity-vault',
    slug: 'velocity-vault',
    name: 'Velocity Vault Momentum',
    version: 'v2.7',
    badge: 'INTRADAY MOMENTUM',
    badgeColor: 'cyan',
    headline: 'London/NY Overlap Expansion Continuation System',
    description:
      'Specialized intraday trend capture engineered around Tier-1 macroeconomic liquidity releases. Exploits liquidity voids and momentum continuations with dynamic order flow management.',
    tierCategory: 'MOMENTUM',
    monthlyPriceNgn: 45000,
    monthlyPriceUsd: 35,
    lifetimePriceNgn: 180000,
    lifetimePriceUsd: 149,
    winRate: '59.2%',
    profitFactor: '2.05',
    sharpeRatio: '1.92',
    maxDrawdown: '4.8%',
    targetPairs: 'EURUSD · GBPUSD · AUDUSD · USDJPY',
    timeframe: 'M15 Execution / H1 Confirmation',
    demoDownloadUrl: '/downloads/Velocity_Vault_Momentum_Demo.mq5',
    demoFilename: 'Velocity_Vault_Momentum_Demo.mq5',
    mqhDownloadUrl: '/downloads/MacroLyncLicense.mqh',
    maxLiveAccounts: 1,
    maxDemoAccounts: 2,
    equityCurvePoints: [100, 101, 104, 103, 107, 110, 109, 114, 118, 117, 122, 125, 129, 133, 137],
    provenanceNote: 'Backtested tick telemetry & London open reference expectation.',
  },
  {
    id: 'macrolync-breakout',
    slug: 'macro-atr-breakout',
    name: 'MacroLync G10 ATR Breakout',
    version: 'v1.0 Demo',
    badge: 'FREE SANDBOX TEST',
    badgeColor: 'amber',
    headline: 'Open-Source Sandbox EA for MetaTrader 5 Terminal Verification',
    description:
      'Pre-configured MIT-licensed open-source test artifact with built-in WebRequest license gating, ATR breakout triggers, and VPS heartbeat telemetry. Ideal for sandbox testing in MetaEditor.',
    tierCategory: 'SANDBOX',
    monthlyPriceNgn: 0,
    monthlyPriceUsd: 0,
    lifetimePriceNgn: 0,
    lifetimePriceUsd: 0,
    winRate: '54.0%',
    profitFactor: '1.62',
    sharpeRatio: '1.45',
    maxDrawdown: '6.9%',
    targetPairs: 'G10 Majors (EURUSD, GBPUSD, USDJPY)',
    timeframe: 'M15 / H1 Volatility',
    demoDownloadUrl: '/downloads/MacroLync_G10_Breakout_Test.mq5',
    demoFilename: 'MacroLync_G10_Breakout_Test.mq5',
    mqhDownloadUrl: '/downloads/MacroLyncLicense.mqh',
    maxLiveAccounts: 0,
    maxDemoAccounts: 99,
    equityCurvePoints: [100, 103, 101, 104, 106, 105, 109, 108, 112, 115, 114, 118, 120, 122, 124],
    provenanceNote: 'Open-source MIT sample EA for compilation and connection testing.',
  },
];

export function getEaBySlug(slug: string): EaProduct | undefined {
  return EA_CATALOG.find((ea) => ea.slug === slug || ea.id === slug);
}
