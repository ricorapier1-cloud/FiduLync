import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Personal EA Lab',
  description: 'Personal EA research library, live signal diagnostics and the MacroLync MT5 bridge.'
};

export default async function PersonalEaLabPage() {
  const bridgeSource = await readFile(join(process.cwd(), 'public', 'mql5', 'MacroLyncBridge.mqh'), 'utf8');
  const initialSnapshot = await getMacroSnapshot();

  return (
    <StoreTerminal
      bridgeSource={bridgeSource}
      initialSnapshot={initialSnapshot}
      session={getLiquiditySession()}
    />
  );
}
