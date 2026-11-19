import { POST as handler } from '@/app/api/v1/validate-license/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handler(request);
}
