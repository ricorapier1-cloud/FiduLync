# Independent quant model validation workflow

Model submissions use `POST /api/owner/research-governance/models` with the owner bearer token. Every submission is stored as `PENDING`; it is never auto-approved.

Required submission content:
- Unique model key/version and market/timeframe scopes.
- SHA-256 dataset and code fingerprints.
- Dataset start/end boundaries and reproducible train/test protocol.
- Walk-forward, out-of-sample, Monte Carlo, cost-stress and reproducibility evidence.
- Trade count, profit factor, expectancy in R, Sharpe, maximum drawdown, Monte Carlo P95 drawdown, walk-forward pass rate, out-of-sample trade count and stressed profit factor.

Independent reviewers use `POST /api/owner/research-governance/models/review` with their own verified Supabase account. Configure `QUANT_INDEPENDENT_REVIEWER_IDS` in Vercel as a comma-separated allowlist of reviewer user UUIDs. The model submitter cannot review their own submission.

An approval requires every checklist item to be true:
- `dataset_verified`
- `code_fingerprint_verified`
- `walk_forward_verified`
- `out_of_sample_verified`
- `monte_carlo_verified`
- `cost_stress_verified`
- `reproducibility_verified`

Every review is recorded in `quant_model_review_events` with a server-computed evidence digest. Database function `review_quant_model` performs the review event insert and registry status update in one transaction. It is executable only by `service_role`.

Approval is a research-governance result only. It does not enable broker execution; execution remains disabled by server policy until separate demo/forward validation and explicit release controls are completed.
