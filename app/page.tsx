import MacroIntelligenceDashboard from '@/app/components/MacroIntelligenceDashboard';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const snapshot = await getMacroSnapshot();
  return <MacroIntelligenceDashboard snapshot={snapshot} />;
}
