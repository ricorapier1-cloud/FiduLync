# Data licensing, attribution and original-work policy

This document is an engineering control, not legal advice. FiduLync is currently a private personal research terminal. A working API key is not evidence that a provider permits caching, storage, derived-data use or display; review the applicable terms before enabling any gated adapter.

## Default-deny provider policy

All third-party data integrations must be server-side, credential-protected, HTTPS-only, timestamped, source-labelled and bounded by provider rate limits. Caching, storage, derived-data use, display and redistribution must be permitted by the provider and any underlying exchange for the intended personal research scope.

The following flags default to `false`. They must not be enabled merely because a key is present:

- `FRED_DATA_STORAGE_PERMISSION_APPROVED`
- `FINNHUB_PERSONAL_PLAN_ACTIVE`
- `ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED`
- `FMP_COMMERCIAL_USE_APPROVED`
- `COT_DATA_PROVIDER_LICENSE_APPROVED`

The operator must confirm the relevant provider plan and exact scope before changing a flag. A personal-use entitlement does not automatically permit long-term storage, redistribution, public display or derived-data delivery.

## Provider-specific controls

### FairEconomy weekly public calendar

The application can read the public weekly JSON feed at https://nfs.faireconomy.media/ff_calendar_thisweek.json without an API key. The personal research fallback is limited to High-impact USD, EUR, GBP, JPY, AUD, CHF and CAD events, preserves provider timestamps in UTC, displays Africa/Lagos WAT, and records `FAIRECONOMY_PUBLIC` provenance. This no-key path is not a grant of redistribution or commercial-use rights; review the provider's current terms before expanding use or redistributing event data.


### FRED / Federal Reserve Bank of St. Louis

FRED series can be owned by third parties. Its API terms require compliance with each series owner's restrictions and include specific prohibitions concerning caching/archiving and use in AI development. Therefore the current FRED adapter is disabled unless the intended private research use, series-level restrictions and data-storage/caching method have been reviewed and expressly approved. Do not assume all series are public domain.

Terms: https://fred.stlouisfed.org/docs/api/terms_of_use.html

### BEA

BEA API terms permit services to analyze and display BEA data, subject to their terms. Display the required notice: "This product uses the Bureau of Economic Analysis (BEA) Data API but is not endorsed or certified by BEA." The application integrates selected BEA real-GDP observations into the macro snapshot. Each observation must retain its actual reference period and source attribution.

Terms: https://apps.bea.gov/api/_pdf/bea_api_tos.pdf
API documentation: https://apps.bea.gov/API/docs/

### Bureau of Labor Statistics (BLS)

When public API data is used, cite the date retrieved and state: "BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov." Do not use BLS logos or falsely represent modified data as official BLS output. The application integrates selected BLS labour and price observations where validated provider responses are available. Missing or stale series remain unavailable rather than being replaced with estimates.

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
