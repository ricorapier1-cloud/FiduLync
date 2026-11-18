import type { Metadata } from 'next';
import ManualRiskPlanner from '@/components/ManualRiskPlanner';

export const metadata: Metadata = {
  title: 'Manual Risk Planner',
  description: 'Broker-aware position sizing and pre-trade risk planning for personal quantitative research.',
};

export default function RiskPlannerPage() {
  return <div className="py-8 sm:py-12"><ManualRiskPlanner /></div>;
}
