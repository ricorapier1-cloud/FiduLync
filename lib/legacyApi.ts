import { NextResponse } from 'next/server';

export function retiredEscrowEndpoint() {
  return NextResponse.json(
    { error: 'This legacy escrow endpoint is retired. Create deals with /api/escrow/create and fund them through the deal checkout link.' },
    { status: 410 },
  );
}
