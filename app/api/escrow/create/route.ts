import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const link_id = `fdl_${Date.now().toString(36)}`
    return NextResponse.json({ success: true, link_id })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
