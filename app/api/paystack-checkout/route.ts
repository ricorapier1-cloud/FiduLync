export const dynamic = 'force-dynamic';
import { POST as initializeMacroVipCheckout } from '@/app/api/macro/vip/route';

export async function POST(request: Request) {
  return initializeMacroVipCheckout(request);
}