export const dynamic = 'force-dynamic';
import { handlePaystackWebhook } from '@/lib/paystackWebhook';

export async function POST(request: Request) {
  return handlePaystackWebhook(request);
}
