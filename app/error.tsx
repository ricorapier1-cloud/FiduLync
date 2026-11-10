'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('Application route error:', error);
  }, [error]);

  return (
    <main className="page-content mx-auto max-w-2xl py-20 text-center">
      <h1 className="text-2xl font-semibold">This page could not be loaded</h1>
      <p className="mt-3 text-sm text-slate-400">A temporary service or application error occurred. Your transaction state has not been changed by this page error.</p>
      {error.digest && <p className="mono mt-3 text-xs text-slate-500">Reference: {error.digest}</p>}
      <button className="primary-button mt-6" onClick={() => retry()}>Try again</button>
    </main>
  );
}
