import { ImageResponse } from 'next/og';

export const alt = 'MacroLync and AlgoLync — FX research and EA systems';
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
            <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
              <path d="M16 4.5 26 9v6.3c0 6.1-4.1 9.6-10 12.2-5.9-2.6-10-6.1-10-12.2V9l10-4.5Z" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 20v-5M15.5 20v-9M21 20v-5M9 21h13" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
          MACROLYNC RESEARCH · ALGOLYNC SYSTEMS · MT5 TELEMETRY
        </div>
      </div>
    ),
    { ...size },
  );
}
