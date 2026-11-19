import type { Metadata } from 'next';
import LegacyStoreTerminal from '@/app/components/LegacyStoreTerminal';
import { getHeartbeatFleet } from '@/lib/eaHeartbeat';
import { getLiquiditySession } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { getTradeExpectancy } from '@/lib/tradeLedger';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Personal EA Lab & MT5 Research Monitor',
  description: 'Private EA telemetry, research signal diagnostics, release evidence and the MacroLync MT5 bridge for the owner’s personal use.',
};

export default async function PersonalEaLabPage() {
  let fleet = { configured: false, heartbeats: [] as Awaited<ReturnType<typeof getHeartbeatFleet>>['heartbeats'] };
  let telemetryError = '';
  try {
    fleet = await getHeartbeatFleet();
  } catch (error) {
    console.error('Unable to load private EA telemetry:', error);
    telemetryError = 'EA telemetry cache is temporarily unavailable.';
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
