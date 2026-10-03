import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const product = searchParams.get('product') || 'AlgoLyn_Demo'
  
  // Clean mock ex5 binary header buffer to ensure 100% successful browser download
  const demoContent = Buffer.from(`MQL5_DEMO_HEADER_ALGOLYN_${product.toUpperCase()}_EX5_BUILD_2026`)
  
  return new NextResponse(demoContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${product.replace(/\s+/g, '_')}_Demo.ex5"`,
    },
  })
}
