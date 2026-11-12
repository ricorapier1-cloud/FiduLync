import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#080a0f',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <path d="M16 4.5 26 9v6.3c0 6.1-4.1 9.6-10 12.2-5.9-2.6-10-6.1-10-12.2V9l10-4.5Z" stroke="#10b981" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M10 20v-5M15.5 20v-9M21 20v-5M9 21h13" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
