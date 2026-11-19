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
  targetPairs: string;
  timeframe: string;
  demoDownloadUrl: string;
  demoFilename: string;
  mqhDownloadUrl: string;
  maxLiveAccounts: number;
  maxDemoAccounts: number;
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
    targetPairs: 'EURUSD · GBPUSD · USDJPY · XAUUSD',
    timeframe: 'H1 Signal / H4 Regime',
    demoDownloadUrl: '/downloads/Eridam_Nexus_Adaptive_Demo.mq5',
    demoFilename: 'Eridam_Nexus_Adaptive_Demo.mq5',
    mqhDownloadUrl: '/downloads/MacroLyncLicense.mqh',
    maxLiveAccounts: 1,
    maxDemoAccounts: 2,
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
    targetPairs: 'EURUSD · GBPUSD · AUDUSD · USDJPY',
    timeframe: 'M15 Execution / H1 Confirmation',
    demoDownloadUrl: '/downloads/Velocity_Vault_Momentum_Demo.mq5',
    demoFilename: 'Velocity_Vault_Momentum_Demo.mq5',
    mqhDownloadUrl: '/downloads/MacroLyncLicense.mqh',
    maxLiveAccounts: 1,
    maxDemoAccounts: 2,
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
    targetPairs: 'G10 Majors (EURUSD, GBPUSD, USDJPY)',
    timeframe: 'M15 / H1 Volatility',
    demoDownloadUrl: '/downloads/MacroLync_G10_Breakout_Test.mq5',
    demoFilename: 'MacroLync_G10_Breakout_Test.mq5',
    mqhDownloadUrl: '/downloads/MacroLyncLicense.mqh',
    maxLiveAccounts: 0,
    maxDemoAccounts: 99,
  },
];

export function getEaBySlug(slug: string): EaProduct | undefined {
  return EA_CATALOG.find((ea) => ea.slug === slug || ea.id === slug);
}
