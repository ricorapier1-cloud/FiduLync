import { retiredEscrowEndpoint } from '@/lib/legacyApi';

export async function POST() {
  return retiredEscrowEndpoint();
}
