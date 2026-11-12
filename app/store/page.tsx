import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { getHeartbeatFleet } from '@/lib/eaHeartbeat';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AlgoLync Store & Live EA Monitor',
  description: 'AlgoLync strategy vault, live expert-advisor fleet telemetry, and the MacroLync MT5 signal bridge.',
};

export default async function AlgoLyncStorePage() {
  let fleet = { configured: false, heartbeats: [] as Awaited<ReturnType<typeof getHeartbeatFleet>>['heartbeats'] };
  let telemetryError = '';
  try {
    fleet = await getHeartbeatFleet();
  } catch (error) {
    console.error('Unable to load EA fleet telemetry for the AlgoLync vault:', error);
    telemetryError = 'Upstash telemetry is temporarily unavailable.';
  }

  const bridgeSource = await readFile(join(process.cwd(), 'public', 'mql5', 'MacroLyncBridge.mqh'), 'utf8');
  const initialSnapshot = await getMacroSnapshot();
  return <StoreTerminal
    initialFleet={fleet}
    telemetryError={telemetryError}
    bridgeSource={bridgeSource}
    initialSnapshot={initialSnapshot}
    session={getLiquiditySession()}
  />;
}
