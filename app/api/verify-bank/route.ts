import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { account_number } = await req.json()
    if (account_number && account_number.length >= 10) {
      return NextResponse.json({ success: true, account_name: 'Verified FiduLync Merchant' })
    }
    return NextResponse.json({ success: false }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
