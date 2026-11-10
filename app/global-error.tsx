'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('Root application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#070a0f', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 640, margin: '12vh auto', padding: 24 }}>
          <h1>FiduLync is temporarily unavailable</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>An unexpected application error occurred. Please try again. If the problem continues, contact support with the reference below.</p>
          {error.digest && <p style={{ color: '#64748b', fontFamily: 'monospace' }}>Reference: {error.digest}</p>}
          <button
            onClick={() => retry()}
            style={{ marginTop: 16, padding: '12px 18px', border: 0, borderRadius: 8, background: '#51e4c2', color: '#070a0f', fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
