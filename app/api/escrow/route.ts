export const dynamic = 'force-dynamic';
import { retiredEscrowEndpoint } from '@/lib/legacyApi';

export async function POST() {
  return retiredEscrowEndpoint();
}
