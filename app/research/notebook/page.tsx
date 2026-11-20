import type { Metadata } from 'next';
import ResearchNotebook from '@/app/components/ResearchNotebook';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Private Research Notebook' };

export default function ResearchNotebookPage() {
  return <ResearchNotebook />;
}
