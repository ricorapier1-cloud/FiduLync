import type { Metadata } from 'next';
import ValidationWorkbench from '@/app/components/ValidationWorkbench';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Strategy Validation Workbench' };

export default function StrategyValidationPage() {
  return <ValidationWorkbench />;
}
