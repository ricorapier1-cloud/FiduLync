# Market-driver data coverage — FiduLync

This register distinguishes implemented adapters from data that still requires a provider contract, exact release metadata, or the owner's MT5 terminal. A source being available does not make its observations real-time, point-in-time safe, or execution eligible.

## Implemented source families

| Market driver | Current source / adapter | Frequency and limitation |
|---|---|---|
| Policy rates | Federal Reserve / FRED, ECB, Bank of Canada, Bank of England, Bank of Japan, RBA, RBNZ, SNB | Official policy releases; update only when the authority publishes or the source updates |
| Headline and core inflation | BLS CPI; FRED PCE/CPI; ECB HICP; Bank of Canada; World Bank G10 CPI | Monthly/quarterly statistical observations; release timestamps/vintages are not yet fully joined |
| Employment | BLS unemployment and nonfarm payroll series | Monthly; observation period is not the exact publication timestamp |
| Economic growth | BEA NIPA Table 1.1.1 real GDP | Quarterly annualized growth; requires `BEA_API_KEY` |
| Treasury curve / real rates | FRED DGS2, DGS10, DFII10 and T10YIE | Daily observations; 10Y real yield is TIPS-derived and breakeven is nominal minus TIPS market pricing, not a pure inflation forecast |
| Broad USD / risk / commodities | FRED DTWEXBGS, VIXCLS, SP500, DCOILWTICO, DCOILBRENTEU and BAMLH0A0HYM2 | Daily macro context; broad trade-weighted USD is not the ICE DXY index; no intraday quote claims |
| Futures positioning | CFTC Commitments of Traders | Weekly futures positioning; not spot FX order flow and can lag. Current adapter carries report date and 52+ week sample size, but not the actual publication timestamp; it is display-only and excluded from composite bias until release metadata is available |
| Economic catalysts | Configured Finnhub, FMP and FairEconomy adapters | Provider entitlement and calendar coverage vary; unavailable events must remain unavailable |
| Executable broker prices | Private MT5 publisher | Only after the owner's Windows MT5 terminal is connected; broker-specific bid/ask, candles and execution telemetry |
| Technical / statistical research | Existing QuantLync engine | Closed-bar, same-provider/same-broker series only; technical confirmation does not replace macro evidence |

## Research factors not yet integrated

These are high-value institutional inputs, but must not be faked or scraped from restricted services:

1. **Expected policy-path repricing:** OIS curves and overnight-rate futures (Fed Funds, SOFR, €STR, SONIA, TONA, CORRA, SARON). Requires a licensed exchange/vendor feed or documented source access.
2. **FX forwards and funding:** forward points, FX swap curves, cross-currency basis and covered-interest-parity dislocations. Requires institutional FX data or broker-provided forward/swap quotes with correct tenor, calendar and collateral conventions.
3. **FX options:** 1W/1M/3M implied volatility, 25-delta risk reversals, butterflies, ATM volatility and term structure. Requires a licensed options feed.
4. **Spot liquidity / order flow:** executable bid/ask depth, dealer streams, trade flow and venue-specific liquidity. Spot FX is fragmented; no single global consolidated tape exists.
5. **Central-bank communication:** speeches, minutes, statements and press conferences with source timestamps, speaker identity and independently tested NLP event classification.
6. **Official release-vintage replay:** ALFRED/FRED vintages and BLS/BEA release calendars with exact publication timestamps. The current BLS/BEA cards are research context only and are excluded from causal point-in-time backtests until this is completed.
7. **Cross-asset breadth:** additional country-specific sovereign curves, commodity terms-of-trade series, funding stress, and aligned regional equity/credit indicators.

## Non-negotiable signal policy

- Never label daily or weekly data as real-time.
- Never label broad trade-weighted USD as DXY.
- Never infer a release timestamp from an observation period.
- Never use revised macro values in a historical replay before their vintage/release date.
- Never merge broker candles from different brokers/providers into one indicator series.
- Never call COT a real-time spot order book.
- Never use COT in a point-in-time composite bias without its actual publication timestamp and a documented historical sample size; report date alone is not release time.
- Never infer OIS, FX options, forwards or order flow from price proxies.
- Missing, stale, delayed, contradictory or unlicensed data must reduce coverage/confidence or produce `ABSTAIN`.
- A factor score is not a calibrated probability; calibration requires untouched out-of-sample evidence.
- Research signals never become execution permission automatically.

## Next integration order

1. Add exact release calendars and vintage-aware BLS/BEA/FRED replay.
2. Add country-specific yield and inflation differentials with synchronized observation times.
3. Add licensed OIS / short-rate futures policy-path data.
4. Add licensed FX forward, basis and options-volatility surfaces.
5. Add source-level health persistence, latency and failure circuit breakers.
6. Wire verified factors into the existing evidence-weighted FX driver model only after unit, sign, freshness and point-in-time tests pass.
