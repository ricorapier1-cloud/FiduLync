import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverSupabase';

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ('response' in result) return result.response;
  return NextResponse.json({ success: true, email: result.user.email });
}

export async function POST(request: Request) {
  return GET(request);
}
