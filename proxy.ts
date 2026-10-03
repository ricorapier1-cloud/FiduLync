import { NextResponse } from 'next/server'

export default function proxy(request) {
  // Pass all requests through normally
  return NextResponse.next()
}
