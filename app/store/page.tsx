import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AlgoLync Personal EA Lab',
  description: 'Private MT5 research bridge, EA diagnostics, personal source library and authenticated risk supervision.',
};

export default async function PersonalEaLabPage() {
  const initialSnapshot = await getMacroSnapshot();
  return <StoreTerminal initialSnapshot={initialSnapshot} session={getLiquiditySession()} />;
}
