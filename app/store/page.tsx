import type { Metadata } from 'next';
import LegacyStoreTerminal from '@/app/components/LegacyStoreTerminal';
import { getHeartbeatFleet } from '@/lib/eaHeartbeat';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { getTradeExpectancy } from '@/lib/tradeLedger';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AlgoLync Store & EA Release Monitor',
  description: 'AlgoLync strategy catalogue, read-only EA telemetry, release verification and the MacroLync MT5 signal bridge. Paid licensing opens only after approved compiled EA artifacts are available.',
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

  const initialSnapshot = await getMacroSnapshot();
  const initialTradeExpectancy = await getTradeExpectancy();

  return (
    <LegacyStoreTerminal
      initialFleet={fleet}
      telemetryError={telemetryError}
      initialSnapshot={initialSnapshot}
      initialTradeExpectancy={initialTradeExpectancy}
      session={getLiquiditySession()}
    />
  );
}
