import MacroDashboard from '@/app/components/MacroDashboard';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialSnapshot = await getMacroSnapshot();
  const vipPrice = 5_000;

  return (
    <MacroDashboard
      initialSnapshot={initialSnapshot}
      vipEnabled={Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_VIP_PLAN_CODE)}
      vipPrice={vipPrice}
    />
  );
}
