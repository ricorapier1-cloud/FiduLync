import StoreTerminal from '@/app/components/StoreTerminal';
import { getHeartbeatFleet } from '@/lib/eaHeartbeat';

export const dynamic = 'force-dynamic';

export default async function AlgoLyncStorePage() {
  let fleet = { configured: false, heartbeats: [] as Awaited<ReturnType<typeof getHeartbeatFleet>>['heartbeats'] };
  let telemetryError = '';
  try {
    fleet = await getHeartbeatFleet();
  } catch (error) {
    console.error('Unable to load EA fleet telemetry for the AlgoLync vault:', error);
    telemetryError = 'Upstash telemetry is temporarily unavailable.';
  }

  return <StoreTerminal initialFleet={fleet} telemetryError={telemetryError} />;
}
