# Data licensing, attribution and original-work policy

This document is an engineering control, not legal advice. Before commercial launch, retain copies of each provider's applicable contract, exchange addenda, pricing tier and written approvals in the company's compliance records. A working API key is not evidence of a redistribution or display licence.

## Default-deny provider policy

All third-party data integrations must be server-side, credential-protected, HTTPS-only, timestamped, source-labelled and bounded by provider rate limits. Commercial display, derived-data display, caching, storage and redistribution must be separately permitted by the provider and any underlying exchange.

The following flags default to `false`. They must not be enabled merely because a key is present:

- `FRED_COMMERCIAL_USE_APPROVED`
- `TWELVE_DATA_COMMERCIAL_USE_APPROVED`
- `FINNHUB_COMMERCIAL_USE_APPROVED`
- `ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED`
- `FMP_COMMERCIAL_USE_APPROVED`
- `FAIRECONOMY_COMMERCIAL_USE_APPROVED`
- `COT_DATA_PROVIDER_LICENSE_APPROVED`
- `MACRO_DATA_PROVIDER_LICENSE_APPROVED`
- `MARKET_DATA_PROVIDER_LICENSE_APPROVED`

The owner must document the relevant written permission and the exact scope before changing a flag. A permission for internal research does not automatically permit customer-facing display, redistribution, caching, or derived-data delivery.

## Provider-specific controls

### FRED / Federal Reserve Bank of St. Louis

FRED series can be owned by third parties. Its API terms require compliance with each series owner's restrictions and include specific prohibitions concerning caching/archiving and use in AI development. Therefore the current FRED adapter is disabled unless the exact proposed commercial use and data handling have been reviewed and expressly approved. Do not assume all series are public domain.

Terms: https://fred.stlouisfed.org/docs/api/terms_of_use.html

### Twelve Data

Individual plans are for personal/internal use and do not permit commercial third-party display or redistribution. Business plans and exchange-specific rights may be required for external display. Derived data must not permit reconstruction of underlying market data; public display may require attribution. The current candle fallback is disabled unless the correct business plan, relevant FX/exchange permissions and display/derived-data rights are documented.

Terms: https://twelvedata.com/terms
Commercial vs personal use: https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage
Attribution: https://support.twelvedata.com/en/articles/12647398-attribution-guidelines-for-using-twelve-data

### BEA

BEA API terms permit services to analyze and display BEA data, subject to their terms. Display the required notice: "This product uses the Bureau of Economic Analysis (BEA) Data API but is not endorsed or certified by BEA." The BEA NIPA adapter is integrated for quarterly real GDP context. Its observations are not used in point-in-time backtests until actual release timestamps and vintages are joined.

Terms: https://apps.bea.gov/api/_pdf/bea_api_tos.pdf
API documentation: https://apps.bea.gov/API/docs/

### Bureau of Labor Statistics (BLS)

When public API data is used, cite the date retrieved and state: "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov." Do not use BLS logos or falsely represent modified data as official BLS output. The BLS adapter is integrated for CPI, core CPI, unemployment and nonfarm payroll context. The API response's observation period is not treated as its release timestamp; no BLS observation is admitted to point-in-time backtests until release metadata is joined.

Terms: https://www.bls.gov/developers/termsOfService.htm

### CFTC, ECB, Bank of Canada, Bank of England and World Bank

Use official source endpoints and retain dataset identifiers, retrieval timestamps, units, frequency, release dates and revision metadata. Preserve each source's attribution and terms. COT is weekly futures positioning context and must never be represented as real-time spot FX order flow.

## Market-data separation

- MT5 broker bid/ask quotes and broker candles are the execution reference for the connected account only.
- Historical/reference sources must never be labelled as executable prices.
- Never mix candle bars from different providers or terminals in one indicator calculation.
- No raw market-data redistribution unless the contract and exchange rights expressly allow it.
- Derived signals must not disclose enough underlying data to reconstruct restricted feeds.

## Original intellectual property

FiduLync/MacroLync/AlgoLync application logic, original code, UI, documentation, quantitative formulas and strategy research should be authored independently for this project. Do not copy proprietary source code, paid indicator implementations, vendor UI assets, logos, data dumps or copyrighted research. Keep provider names and trademarks factual and do not imply endorsement.

Before every release:
1. Generate a production dependency inventory and review each dependency's licence.
2. Keep required open-source notices and attribution.
3. Scan for secrets, copied assets and unlicensed datasets.
4. Verify all provider approvals and source labels.
5. Block deployment if a required licence approval is absent.

## Accuracy and integrity

Provider terms do not guarantee data accuracy. Every observation must carry source, retrieval time, observation/release time, units, frequency, freshness, revision status and validation status. Missing, stale, revised, contradictory or malformed observations must be flagged and excluded from execution decisions. Never replace missing live observations with reference values while labelling the result live.


## Central-bank adapter commercial-use gates

The SNB data portal states that reuse of its data is permitted for non-commercial purposes compatible with its purpose. FiduLync must not ingest SNB observations for commercial use until the applicable commercial permission is verified. The CHF adapter therefore remains disabled unless `SNB_COMMERCIAL_USE_APPROVED=true` is configured after documented permission. It fails closed by leaving CHF policy-rate provenance unverified. Do not set this variable merely to bypass the guard.

RBA, BOJ and RBNZ observations are fetched from their official public statistical interfaces with source links retained in the macro snapshot. Verify each provider's current reuse terms before commercial distribution, and keep any provider-specific opt-in gate in place where required.
