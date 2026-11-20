# Product EA source intake

Place the actual, reviewed commercial EA `.mq5` source files in this directory when the Windows laptop is available.

- Keep each EA's required `.mqh` dependencies under `MQL5/Include/`.
- Do not put compiled `.ex5` binaries, broker credentials, publisher tokens or private API keys in Git.
- Run `scripts/compile_mt5.ps1 -MetaEditorPath "<actual metaeditor64.exe>" -RequireProductSources`.
- The script compiles every `.mq5` file in this directory recursively and requires MetaEditor's exact zero-error, zero-warning result plus a generated `.ex5`.
- Run Strategy Tester and demo-account forward validation before uploading the binary through `/owner` → Release governance.
- Uploading calculates/registers SHA-256 metadata but does not approve the product. Explicit owner release approval is a separate audited step.

No sample source file is included here; the commercial EA source must be the real, reviewed source, not a template.
