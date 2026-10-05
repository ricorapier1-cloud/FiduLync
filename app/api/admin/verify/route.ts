import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    const adminPassword = process.env.ADMIN_PASSWORD || 'FiduLync37422445$'

    if (password === adminPassword) {
      return NextResponse.json({ success: true, token: 'admin_authenticated_session' })
    }

    return NextResponse.json({ success: false, error: 'Incorrect Admin Password' }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
