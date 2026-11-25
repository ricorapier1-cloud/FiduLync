import MacroDashboard from '@/app/components/MacroDashboard';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import type { GoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialSnapshot = await getMacroSnapshot();
  const initialGoldContext = await buildGoldMacroContext(initialSnapshot).catch((error: unknown) => {
    console.warn('Initial gold macro context is unavailable; no directional claim will be shown.', error);
    return null as GoldMacroContext | null;
  });

  return (
    <MacroDashboard
      initialSnapshot={initialSnapshot}
      initialGoldContext={initialGoldContext}
    />
  );
}
