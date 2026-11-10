import MacroDashboard from '@/app/components/MacroDashboard';
import { SEED_SNAPSHOT } from '@/lib/macroData';

export default function Home() {
  const configuredPrice = Number(process.env.MACRO_VIP_PRICE_NGN);
  const vipPrice = Number.isFinite(configuredPrice) && configuredPrice > 0 ? configuredPrice : 5_000;

  return (
    <MacroDashboard
      initialSnapshot={SEED_SNAPSHOT}
      vipEnabled={Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_VIP_PLAN_CODE)}
      vipPrice={vipPrice}
    />
  );
}
