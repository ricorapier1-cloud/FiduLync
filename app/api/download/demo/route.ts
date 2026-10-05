import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file') || 'Eridam_Nexus_Adaptive_Demo.ex5';

  const binaryHeader = `// AlgoLync Quant Suite - Compiled Demo File\n// EA Identifier: ${file}\n// FiduLync Engineering Production License`;
  const buffer = Buffer.from(binaryHeader, 'utf-8');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
