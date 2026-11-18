import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Personal EA Lab & MT5 Monitor',
  description: 'Personal EA research library, MT5 fleet telemetry, live signal diagnostics and the MacroLync bridge.'
};

export default async function PersonalEaLabPage() {
  const bridgeSource = await readFile(join(process.cwd(), 'public', 'mql5', 'MacroLyncBridge.mqh'), 'utf8');
  const initialSnapshot = await getMacroSnapshot();

  return (
    <StoreTerminal
      initialFleet={fleet}
      telemetryError={telemetryError}
      bridgeSource={bridgeSource}
      initialSnapshot={initialSnapshot}
        session={getLiquiditySession()}
    />
  );
}
