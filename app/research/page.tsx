import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Personal Quant Research Lab',
  description: 'Private quantitative research library, live signal diagnostics and the MacroLync MT5 bridge.'
};

export default async function PersonalEaLabPage() {
  const initialSnapshot = await getMacroSnapshot();

  return (
    <StoreTerminal
      initialSnapshot={initialSnapshot}
      session={getLiquiditySession()}
    />
  );
}
