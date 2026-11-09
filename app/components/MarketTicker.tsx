'use client';

import { useEffect, useState } from 'react';

type Instrument = {
  symbol: string;
  price: number;
  change: number;
  step: number;
  decimals: number;
};

const initialQuotes: Instrument[] = [
  { symbol: 'EURUSD', price: 1.08421, change: 0.12, step: 0.00003, decimals: 5 },
  { symbol: 'XAUUSD', price: 2358.42, change: 0.38, step: 0.11, decimals: 2 },
  { symbol: 'BTCUSD', price: 68420.18, change: -0.74, step: 8.25, decimals: 2 },
];

export default function MarketTicker() {
  const [quotes, setQuotes] = useState(initialQuotes);

  useEffect(() => {
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setQuotes((current) => current.map((quote, index) => ({
        ...quote,
        price: Number((quote.price + quote.step * Math.sin(tick + index)).toFixed(quote.decimals)),
      })));
    }, 2400);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="market-strip" aria-label="Simulated market quotes and system status">
      <div className="market-feed-label"><span className="status-dot" /><span>SIMULATED FEED</span><span className="feed-divider">/</span><span className="feed-demo">DEMO VALUES</span></div>
      <div className="market-quotes">
        {quotes.map((quote) => (
          <div className="market-quote mono" key={quote.symbol}>
            <span className="quote-symbol">{quote.symbol}</span>
            <strong>{quote.price.toLocaleString('en-US', { minimumFractionDigits: quote.decimals, maximumFractionDigits: quote.decimals })}</strong>
            <span className={quote.change >= 0 ? 'quote-change quote-up' : 'quote-change quote-down'}>{quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <div className="market-status mono"><span className="status-dot" /><span>SYSTEM ONLINE</span><b>LATENCY &lt;12MS</b></div>
    </section>
  );
}