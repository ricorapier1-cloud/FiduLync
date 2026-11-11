import { ImageResponse } from 'next/og';

export const alt = 'MacroLync — Global FX Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#080a0f',
          backgroundImage: 'radial-gradient(ellipse at 82% 18%, rgba(16, 185, 129, 0.18), transparent 42%)',
          color: '#edf3f4',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #10b981',
              borderRadius: 12,
              color: '#10b981',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-2px' }}>MacroLync</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <span style={{ color: '#10b981', fontSize: 18, letterSpacing: 5 }}>GLOBAL FX INTELLIGENCE</span>
          <span style={{ fontSize: 47, fontWeight: 700, lineHeight: 1.25 }}>
            POLICY DIVERGENCE.
            <br />
            POSITIONING. CATALYSTS.
          </span>
          <span style={{ color: '#99a6ad', fontSize: 20 }}>
            Institutional-style foreign exchange macro research.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#71817f', fontSize: 14 }}>
          <span style={{ color: '#10b981' }}>●</span>
          LIVE MACRO DATA · CFTC POSITIONING · MT5 SIGNALS
        </div>
      </div>
    ),
    { ...size },
  );
}
