import type { Metadata } from 'next';
import QuantResearchLab from '@/app/components/QuantResearchLab';

export const metadata: Metadata = {
  title: 'QuantLync Research Lab',
  description: 'Private multi-timeframe technical and statistical research with verified data provenance and risk diagnostics.',
};

export default function QuantResearchLabPage() {
  return <QuantResearchLab />;
}
