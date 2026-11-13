'use client';
import { useEffect, useState } from 'react';

export function LiveUtcClock() {
  const [utcNow, setUtcNow] = useState<string>(() =>
    new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setUtcNow(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <span className="font-mono tracking-wider text-emerald-400">{utcNow}</span>;
}
