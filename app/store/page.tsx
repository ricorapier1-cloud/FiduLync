import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { getTradeExpectancy } from '@/lib/tradeLedger';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AlgoLync Strategy Marketplace',
  description: 'Browse quantitative EA subscriptions, request eligible demos and select recurring billing.',
};

export default async function AlgoLyncStorePage() {
  const initialSnapshot = await getMacroSnapshot();
  const initialTradeExpectancy = await getTradeExpectancy();
  return (
    <StoreTerminal
      initialSnapshot={initialSnapshot}
      initialTradeExpectancy={initialTradeExpectancy}
      session={getLiquiditySession()}
    />
  );
}
