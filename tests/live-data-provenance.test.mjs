import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const macroData = read('../lib/macroData.ts');
const macroEngine = read('../lib/macroEngine.ts');
const currencyStrength = read('../lib/currencyStrength.ts');
const dashboard = read('../app/components/MacroDashboard.tsx');
const marketFeeds = read('../lib/marketFeeds.ts');
const productRelease = read('../lib/productRelease.ts');
const checkout = read('../app/api/v1/create-checkout/route.ts');
const licenseValidation = read('../app/api/v1/validate-license/route.ts');
const paidProvisioning = read('../lib/provisionLicense.ts');
const demoProvisioning = read('../app/api/v1/provision-demo-license/route.ts');
const productCatalog = read('../lib/eaCatalog.ts');
const catalogUi = read('../components/QuantStrategyCatalog.tsx');
const artifactApi = read('../app/api/owner/artifacts/route.ts');
const uploadUrlApi = read('../app/api/owner/artifacts/upload-url/route.ts');
const registerApi = read('../app/api/owner/artifacts/register/route.ts');
const artifactUi = read('../app/owner/OwnerArtifactRelease.tsx');
const compileScript = read('../scripts/compile_mt5.ps1');
const productReadiness = read('../app/api/v1/product-readiness/route.ts');
const readme = read('../README.md');
const artifactMigration = read('../supabase/migrations/20261119133005_ea_artifact_audit_action_types.sql');
const idempotentArtifactMigration = read('../supabase/migrations/20261119134000_idempotent_ea_artifact_registration.sql');

test('provider outage returns an empty, untimestamped macro fallback', () => {
  const fallback = macroData.match(/export function getFallbackSnapshot\(\): MacroSnapshot \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fallback, 'fallback snapshot function exists');
  assert.match(fallback, /asOf: ''/);
  assert.match(fallback, /currencies: \[\]/);
  assert.match(fallback, /cot: \[\]/);
  assert.match(fallback, /catalysts: \[\]/);
  assert.doesNotMatch(fallback, /policyRate: [1-9]|inflation: [1-9]/);
});

test('only complete provider-sourced policy and inflation observations leave the adapter', () => {
  assert.match(macroData, /getLiveProviderSnapshot\(\)/);
  assert.doesNotMatch(macroData, /cachedSnapshot\.currencies/);
  assert.match(macroData, /policyRateProvider = 'fred'/);
  assert.match(macroData, /calendarProvider = selectedCalendar\.provider/);
  assert.match(macroData, /snapshot\.currencies = snapshot\.currencies\.filter\(\(currency\) =>\s*currency\.policyRateSource === 'provider' && currency\.inflationSource === 'provider'\)/);
  assert.match(currencyStrength, /item\.policyRateSource === 'provider'/);
  assert.match(currencyStrength, /item\.inflationSource === 'provider'/);
});

test('stale macro snapshots are rejected instead of silently reused', () => {
  assert.match(macroEngine, /ageMs > 24 \* 60 \* 60_000/);
  assert.match(macroEngine, /return getFallbackSnapshot\(\)/);
  assert.match(macroEngine, /calendarProvider === 'finnhub'/);
  assert.match(macroEngine, /COT_DATA_PROVIDER_LICENSE_APPROVED === 'true'/);
  assert.match(macroEngine, /FRANKFURTER_COMMERCIAL_USE_APPROVED === 'true'/);
});

test('dashboard never substitutes hardcoded events, policy ranges, or positioning figures', () => {
  assert.doesNotMatch(dashboard, /US Non-Farm Payrolls|425 bps \(G8\)|Tier-1 Catalyst • 13:30 UTC/);
  assert.match(dashboard, /providerPolicyInputs/);
  assert.match(dashboard, /NO VERIFIED DATA/);
  assert.match(dashboard, /formatQuoteAge\(quote\.timestamp, now\)/);
  assert.match(dashboard, /SNAPSHOT REFRESHED/);
  assert.doesNotMatch(dashboard, /'LIVE' : snapshot\.source/);
});

test('third-party quote feeds require explicit commercial-use approval', () => {
  assert.match(marketFeeds, /FINNHUB_COMMERCIAL_USE_APPROVED === 'true'/);
  assert.match(marketFeeds, /FRANKFURTER_COMMERCIAL_USE_APPROVED !== 'true'/);
  assert.match(marketFeeds, /EXCHANGERATE_API_COMMERCIAL_USE_APPROVED !== 'true'/);
  assert.match(marketFeeds, /GOLD_API_COMMERCIAL_USE_APPROVED !== 'true'/);
});

test('paid and demo licensing require a verified private compiled release artifact', () => {
  assert.match(productRelease, /release_approved === true/);
  assert.match(productRelease, /verifyStoredObjectHash/);
  assert.match(productRelease, /createHash\('sha256'\)/);
  assert.match(productRelease, /sha256/);
  assert.match(productRelease, /storage\/v1\/object\/sign\/algolync-artifacts/);
  assert.match(checkout, /hasApprovedProductArtifact\(eaSlug\)/);
  assert.match(licenseValidation, /hasApprovedProductArtifact\(license\.ea_slug\)/);
  assert.match(paidProvisioning, /hasApprovedProductArtifact\(eaSlug\)/);
  assert.match(demoProvisioning, /hasApprovedProductArtifact\(eaSlug\)/);
});

test('catalogue does not ship illustrative performance metrics or equity curves', () => {
  assert.doesNotMatch(productCatalog, /winRate|profitFactor|sharpeRatio|maxDrawdown|equityCurvePoints/);
  assert.doesNotMatch(catalogUi, /InteractiveSparkline|strategy\.winRate|strategy\.profitFactor|SIMULATED ILLUSTRATION/);
  assert.match(catalogUi, /AWAITING APPROVED BUILD/);
});

test('private EA artifact upload uses owner-only signed Storage URLs and audited registration', () => {
  assert.match(artifactApi, /requireOwner/);
  assert.match(artifactApi, /set_ea_product_artifact_release_status/);
  assert.match(uploadUrlApi, /object\/upload\/sign\/algolync-artifacts/);
  assert.match(uploadUrlApi, /requireOwner/);
  assert.match(registerApi, /hasPrivateStorageObject/);
  assert.match(registerApi, /record_ea_product_artifact_upload/);
  assert.match(idempotentArtifactMigration, /release_approved = CASE/);
  assert.match(artifactMigration, /EA_ARTIFACT_RELEASE_APPROVED/);
  assert.match(artifactUi, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(artifactUi, /api\/owner\/artifacts\/upload-url/);
  assert.match(artifactUi, /api\/owner\/artifacts\/register/);
  assert.match(artifactUi, /signedPayload\.already_exists/);
});

test('owner release approval is distinct from upload and laptop compile is prepared', () => {
  assert.match(artifactUi, /Approve release/);
  assert.match(artifactUi, /zero errors and zero warnings/);
  assert.match(compileScript, /RequireProductSources/);
  assert.match(compileScript, /Experts\\Release/);
  assert.match(productReadiness, /enforceDistributedRateLimit/);
  assert.match(readme, /There is no curated or synthetic event fallback/);
});
