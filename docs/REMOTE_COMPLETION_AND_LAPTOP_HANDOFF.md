# FiduLync Personal Quant — remote completion and laptop handoff

**Purpose:** finish all repository, web-platform, schema, CI and integration preparation that can be completed without a Windows MT5 terminal. This runbook is the controlled handoff for the remaining terminal-dependent work.

## 1. Non-negotiable operating boundary

- The Personal Quant EA supervisor is advisory and read-only. It may return `APPROVE`, `REDUCE`, `REJECT` or `ABSTAIN` and risk ceilings; it must never call `OrderSend`, modify positions, close positions or manage broker orders.
- The supervisor's current server policy intentionally fails closed. Do not enable execution/model approval flags merely to obtain an approval.
- Do not connect a live account for initial validation. Use a broker demo account and a dedicated MT5 terminal.
- Never send broker passwords, investor passwords, service-role keys, publisher tokens or provider secrets in chat, source code, screenshots or GitHub issues.
- Research metrics are not calibrated probabilities and do not promise returns.

## 2. Remote work completed in the repository

The Personal Quant branch includes:
- Owner-only research workspace and authenticated server-side owner checks.
- Read-only MT5 publisher and supervisor APIs with installation-scoped tokens, replay protection, timestamp validation and fail-closed data validation.
- Closed H1/H4/D1 candle research, quote freshness, account/position snapshots and explicit incomplete-snapshot handling.
- Server-owned risk context, risk decision audit evidence and independent model-review data structures.
- Execution evidence ingestion with idempotency, event hashing and optional request-price/spread/slippage/latency fields.
- A compile-only MQL5 fixture that includes both the supervisor and execution telemetry modules.
- A PowerShell MetaEditor compile script that requires an exact **0 errors, 0 warnings** result and generated EX5 output for each fixture.
- An owner-triggered GitHub Actions workflow for a dedicated Windows runner labelled `mt5`. It does not run on pull requests and does not execute on ordinary GitHub-hosted runners.

## 3. Laptop prerequisites

Use a 64-bit Windows 10/11 laptop or Windows VPS. Install:
1. MetaTrader 5 from your broker or MetaQuotes, then log in manually to a **demo** account.
2. MetaEditor supplied with that MT5 installation.
3. Python 3.11+ (64-bit) and Git for Windows.
4. A password manager for the one-time publisher token.

No broker password is required by FiduLync. The publisher reads data from the already logged-in local MT5 terminal.

## 4. Get the reviewed source

Clone the repository and checkout the Personal Quant branch:

```powershell
git clone https://github.com/ricorapier1-cloud/FiduLync.git
cd FiduLync
git checkout feat/personal-quant-edition
git pull
```

If Git is not installed, download the branch ZIP from GitHub and extract it. Do not use an old ZIP or a previous deployment's source.

## 5. Compile the MQL5 connectors

Find the `metaeditor64.exe` belonging to the MT5 terminal you intend to use. Run PowerShell from the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\compile_mt5.ps1 -MetaEditorPath "C:\Program Files\Your Broker MT5\metaeditor64.exe"
```

The path above is an example; replace it with the actual MetaEditor path on the laptop.

The script compiles:
- `MQL5/Experts/FiduLync_Supervisor_Probe.mq5`
- `MQL5/Experts/FiduLync_Integration_Compile_Check.mq5`

It checks MetaEditor's own compilation log, rejects missing or unrecognized result lines, rejects every warning as well as every error, and confirms that an EX5 was generated. Logs and EX5 files remain local build outputs.

Expected result for **each** fixture: `0 errors, 0 warnings`.

If a compile fails:
- Stop; do not attach the EA or attempt a live connection.
- Preserve the full compiler log.
- Fix the exact source issue, commit it to the feature branch, rerun the web CI gate, then rerun this compiler script.
- Do not silence warnings or weaken the script's zero-warning check.

The compile-only fixture is not a trading EA. It makes no network requests and cannot trade.

## 6. Prepare the MT5 publisher

After the latest Personal Quant source has a verified deployment containing the account-snapshot and ingestion changes:

1. Sign in to the FiduLync owner console using the authorized owner mailbox.
2. Create one MT5 publisher installation and copy the one-time token into your password manager. If lost, revoke that installation and create another; do not attempt to recover the token.
3. Install the Python connector dependency:

```powershell
py -3.11 -m pip install MetaTrader5
```

4. Set the publisher environment variables in the same Windows session. Use the exact verified deployment URL, not an old preview:

```powershell
$env:FIDULYNC_PUBLISHER_TOKEN = "<paste-one-time-token-locally>"
$env:FIDULYNC_INGEST_URL = "https://<verified-deployment-host>/api/v1/market-data/ingest"
$env:MT5_SYMBOL_MAP = "EURUSD=EURUSD,GBPUSD=GBPUSD,USDJPY=USDJPY,USDCHF=USDCHF,USDCAD=USDCAD,AUDUSD=AUDUSD,NZDUSD=NZDUSD,XAUUSD=XAUUSD"
py -3.11 scripts/mt5_market_publisher.py
```

Replace the symbol map values with the exact names shown by your broker. If the broker uses suffixes, map canonical symbols to the broker's actual Market Watch symbols, e.g. `EURUSD=EURUSD.a`.

5. Confirm the publisher reports successful ingestion and the owner diagnostics show fresh broker timestamps, quotes, H1/H4/D1 candles, account state and complete position manifests. Missing data must remain visibly unavailable; do not fabricate it.

## 7. Install the supervisor probe in MT5

Copy the repository files into the active terminal's data folder:
- `MQL5/Include/FiduLync/QuantSupervisor.mqh`
- `MQL5/Experts/FiduLync_Supervisor_Probe.mq5`

In MT5, open **File → Open Data Folder** to locate the correct terminal data directory. Create the `Include/FiduLync` directory if it does not exist.

In **Tools → Options → Expert Advisors**, add the verified HTTPS deployment origin to the WebRequest allowlist. Compile the probe in MetaEditor and confirm zero errors and warnings. Set the probe inputs to the installation ID, one-time publisher token, verified deployment URL and canonical symbol. Attach it only to a demo chart.

The probe is deliberately a no-trade connectivity test. Its expected outcome while governance gates remain closed is a safe abstention/degraded decision, not an order.

## 8. Add execution telemetry to an existing EA only after review

The evidence include is:
- `MQL5/Include/FiduLync/ExecutionTelemetry.mqh`

Do not overwrite or duplicate existing EA event handlers. Merge the following into the EA's existing handlers:
- One global `CFiduLyncExecutionTelemetry` instance.
- `Configure(...)` in the existing `OnInit()`.
- `Flush()` inside the existing throttled `OnTimer()` (recommended five-second cadence).
- `CaptureTradeTransaction(trans, request, result)` inside the existing `OnTradeTransaction()`.
- Preserve any existing timer logic; do not create a second `OnTimer()` or stop a timer that another module still needs.

For requested-price/slippage/latency evidence, adapt the documented `RegisterOrderRequest(...)` call around the EA's existing order-send wrapper. Capture the local monotonic timestamp and spread immediately before the existing send. Correlate by broker order ticket. This telemetry is evidence only; it must not change the EA's entry, exit, sizing or order-management logic.

Compile the complete EA—not just the include—and inspect every warning. Then run Strategy Tester and demo forward tests. No EX5 should be labelled release-approved until the full source and tests have been reviewed.

## 9. Optional owner-controlled Windows CI runner

A dedicated Windows runner can execute `.github/workflows/mt5-metaeditor-compile.yml` from the Personal Quant branch. This is optional; the local PowerShell compiler script is sufficient for a first laptop validation.

If you configure the runner:
- Register it only at the repository level with labels `windows` and `mt5`.
- Set repository Actions variable `METAEDITOR64_PATH` to the exact `metaeditor64.exe` path.
- Use a dedicated Windows account or isolated VM with no personal documents, browser sessions or unrelated credentials.
- Never run untrusted pull-request code on a self-hosted runner. The workflow is manual-dispatch only and branch-restricted.
- Keep the runner offline when not compiling; remove it when no longer needed.
- The workflow cannot run until that runner is registered and online. If its queued job expires before the laptop is ready, push a reviewed MQL5/compile-script change to create a fresh job; the local PowerShell script remains the direct option.

## 10. Production release gates

Do not merge or promote the Personal Quant branch until all of these are true:
- Current branch-head CI passes.
- A Vercel preview for the exact current commit is READY and authenticated runtime smoke tests pass.
- Supabase Auth custom SMTP, OTP/magic-link template, exact redirect allowlist and MFA/step-up configuration are verified.
- Leaked-password protection is enabled where the Supabase plan supports it.
- Market-data provider terms, commercial use, caching, display and derived-data permissions are documented per provider. Keep restricted adapters disabled until written permission exists.
- Account-currency conversion and portfolio stress aggregation are validated against broker-native contract metadata.
- Model validation has chronological out-of-sample and walk-forward evidence, cost stress and independent reviewer approval. Until then, no model is approved.
- The publisher and supervisor have been tested against real demo-terminal data and actual broker contract specifications.
- The complete consuming EA compiles with zero errors and zero warnings and passes Strategy Tester plus demo forward validation.
- No unresolved high-severity security finding remains.

## 11. Current external service limitations

- The current Supabase project is reachable and active. Server-only Personal Quant tables have RLS enabled and explicit client-deny policies. The current security advisor still reports leaked-password protection disabled.
- Supabase custom SMTP, Auth templates, redirect allowlist and MFA settings require provider-side configuration and an actual email/authentication test.
- Vercel's Hobby plan documents a limit of 100 deployments per rolling 24 hours. If the quota is reached, wait for the rolling window to reset; do not repeatedly retry deployments. The currently inspected READY preview is an earlier commit than the current PR head.
- Unused-index advisor notices are not grounds for deleting indexes in a database that has not yet received representative production traffic. The duplicate `escrows.slug` index is legacy and separate from Personal Quant; retain the unique constraint and review any redundant index removal as a separately tested migration.
- The Personal Quant Supabase data tables contain no broker-terminal evidence until the Windows publisher connects.

## 11. Additional Vercel secret-visibility remediation

The current Vercel environment metadata flags the legacy `ALGOLYNC_LEASE_SIGNING_SECRET` as a readable secret in its production and preview/development scopes. This is separate from the Personal Quant publisher token, but it protects the legacy AlgoLync licence lease flow and should not remain readable by project members who do not need it.

Before the next production release:
1. In Vercel Project → Settings → Environment Variables, change the variable to Secret visibility in every scope where it is used.
2. Coordinate any value rotation with the legacy licence verification service and active EA clients; do not rotate blindly because existing signed leases may stop validating.
3. Verify lease issuance and verification in a controlled test before promoting.
4. Never paste or export the value into chat, source control, build logs or screenshots.

The connected Vercel API can inspect environment-variable metadata but does not provide a safe value-preserving visibility-only update in this workflow. This dashboard step therefore remains an explicit operator task.

## 12. Completion definition

Remote code is ready for terminal validation when the current-head CI and preview are green, the Auth and data-license gates are closed, and the Windows compiler script passes. The system is operationally ready for live trading only after independent model review, demo execution-quality evidence, broker-specific risk validation and a separate explicit release approval. A green website build alone never grants trading authority.
