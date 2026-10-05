import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file') || 'Eridam_Nexus_Adaptive_Demo.ex5';

  const fileContent = `// AlgoLync Quant Suite - Demo Executable\n// System: MetaTrader 5\n// Target File: ${file}\n// Standard Demo License Built by FiduLync Engineering`;
  const buffer = Buffer.from(fileContent, 'utf-8');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Length': buffer.length.toString(),
    },
  });
}
