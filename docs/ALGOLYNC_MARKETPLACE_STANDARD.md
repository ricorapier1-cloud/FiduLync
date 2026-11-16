# AlgoLync Marketplace Standard

## Product lifecycle
1. Draft — internal product specification only.
2. Sandbox — educational source or demo, explicitly non-commercial.
3. QA pending — source is submitted for compilation, strategy tests and compatibility checks.
4. Verified — evidence is published with exact test conditions and provenance.
5. Commercial — a tested release with licence, support, version and delivery terms.
6. Retired — purchases disabled; existing customers retain the stated update/support rights.

## Required product-page evidence
- Product version, release date and changelog.
- Supported MT5 builds, broker/account mode, symbols and timeframes.
- Strategy description and risk controls.
- Whether the EA can place trades, and whether grid, martingale, averaging or hedging are used.
- Real tick backtest report, date range, symbol, timeframe, broker, spread/commission assumptions, modelling quality and deposit/leverage.
- Forward-test record clearly separated from backtests.
- Profit factor, drawdown, Sharpe and win rate only when supported by reproducible reports.
- Installation, WebRequest permissions, licence activation, update and support instructions.
- Refund, subscription renewal and licence transfer terms.

## Evidence policy
Never invent returns, equity curves, reviews, ratings, customer counts or verification badges. A backtest is not a live result. A demo source file is not a compiled or tested EX5 binary. Do not imply MetaTrader or a broker endorses FiduLync.

## Open-source policy
Third-party source must remain at its original source unless the licence explicitly permits redistribution and modification. Keep attribution, licence and notices intact. The MIT notice shipped with this sandbox applies only to the two original educational sample files in `public/downloads/` named in TEST_EA_LICENSE.txt.

## Current sandbox files
- AlgoLync_Moving_Average_Lab.mq5 — original FiduLync analysis-only diagnostics; no orders.
- AlgoLync_ATR_Regime_Lab.mq5 — original FiduLync analysis-only diagnostics; no orders.
- README_SANDBOX_EAS.txt — install and test instructions.
- TEST_EA_LICENSE.txt — exact MIT grant scope.

## Not production-ready until
- Compile each source in MetaEditor with zero errors and warnings.
- Run MT5 Strategy Tester and manual demo-terminal smoke tests.
- Verify downloads, checkout, webhook signature, licence creation, licence validation, customer portal and email delivery.
- Test monthly renewal/expiry and lifetime licence handling.
- Verify all claims against retained evidence before publishing.
