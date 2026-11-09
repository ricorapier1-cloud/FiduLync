import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = url.searchParams.get('product') || 'AlgoLync';
  return NextResponse.redirect(new URL(`/api/download/demo?file=${encodeURIComponent(product)}`, url.origin));
}
