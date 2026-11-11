import MacroDashboard from '@/app/components/MacroDashboard';
import { getMacroSnapshot } from '@/lib/macroEngine';
import { getMarketQuotes } from '@/lib/marketFeeds';
import type { MarketQuote } from '@/types/macro';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [initialSnapshot, initialQuotes] = await Promise.all([
    getMacroSnapshot(),
    getMarketQuotes().catch((error: unknown) => {
      console.warn('Initial market quotes are unavailable; the dashboard will retry.', error);
      return [] as MarketQuote[];
    }),
  ]);
  const vipPrice = 5_000;

  return (
    <MacroDashboard
      initialSnapshot={initialSnapshot}
      initialQuotes={initialQuotes}
      vipEnabled={Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_VIP_PLAN_CODE)}
      vipPrice={vipPrice}
    />
  );
}
