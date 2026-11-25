import MacroDashboard from '@/app/components/MacroDashboard';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { getMarketQuotes } from '@/lib/marketFeeds';
import { buildGoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import type { GoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import type { MarketQuote } from '@/types/macro';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [initialSnapshot, initialQuotes, initialGoldContext] = await Promise.all([
    getMacroSnapshot(),
    getMarketQuotes().catch((error: unknown) => {
      console.warn('Initial market quotes are unavailable; the dashboard will retry.', error);
      return [] as MarketQuote[];
    }),
    buildGoldMacroContext().catch((error: unknown) => {
      console.warn('Initial gold macro context is unavailable; no directional claim will be shown.', error);
      return null as GoldMacroContext | null;
    }),
  ]);

  return (
    <MacroDashboard
      initialSnapshot={initialSnapshot}
      initialQuotes={initialQuotes}
      initialGoldContext={initialGoldContext}
    />
  );
}
