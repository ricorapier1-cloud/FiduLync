from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PersonalQuantSecurityContractTests(unittest.TestCase):
    def read(self, path: str) -> str:
        return (ROOT / path).read_text(encoding="utf-8")

    def test_retired_commercial_endpoints_fail_closed_with_gone(self):
        routes = (
            "app/api/v1/validate-license/route.ts",
            "app/api/v1/license/verify/route.ts",
            "app/api/v1/license/heartbeat/route.ts",
            "app/api/v1/license-bind/route.ts",
            "app/api/v1/license-transfer/route.ts",
            "app/api/v1/lookup-license/route.ts",
            "app/api/v1/provision-demo-license/route.ts",
            "app/api/v1/create-checkout/route.ts",
            "app/api/v1/customer-portal/route.ts",
            "app/api/v1/paystack-webhook/route.ts",
            "app/api/paystack/webhook/route.ts",
            "app/api/owner/licenses/route.ts",
        )
        for route in routes:
            with self.subTest(route=route):
                source = self.read(route)
                self.assertIn("status: 410", source)
                self.assertIn("Personal Quant Edition", source)

    def test_rate_limiter_uses_trusted_proxy_ip_and_durable_rpc(self):
        source = self.read("lib/rateLimit.ts")
        self.assertIn("x-real-ip", source)
        self.assertNotIn("x-forwarded-for", source)
        self.assertIn("/rest/v1/rpc/consume_api_rate_limit", source)
        self.assertIn("unavailable: true", source)
        migration = self.read("supabase/migrations/20261119103343_durable_api_sliding_window_rate_limit.sql")
        self.assertIn("pg_advisory_xact_lock", migration)
        self.assertIn("occurred_at", migration)
        self.assertIn("GRANT EXECUTE", migration)

    def test_owner_login_is_password_only_with_recovery_only_email(self):
        for path in ("app/owner/page.tsx", "components/OwnerConsole.tsx"):
            with self.subTest(path=path):
                source = self.read(path)
                self.assertIn("signInWithPassword", source)
                self.assertIn("resetPasswordForEmail", source)
                self.assertNotIn("signInWithOtp", source)
                self.assertNotIn("verifyOtp", source)

    def test_private_owner_mutations_verify_the_owner_identity(self):
        owner_routes = (
            "app/api/owner/operations/route.ts",
            "app/api/owner/mt5-installations/route.ts",
            "app/api/owner/control-plane/route.ts",
            "app/api/owner/research-governance/route.ts",
            "app/api/owner/research-governance/models/route.ts",
            "app/api/owner/research-governance/validate/route.ts",
            "app/api/owner/artifacts/upload-url/route.ts",
            "app/api/owner/artifacts/register/route.ts",
            "app/api/mt5/installations/route.ts",
        )
        for route in owner_routes:
            with self.subTest(route=route):
                self.assertIn("requireOwner(request)", self.read(route))

    def test_mt5_market_ingestion_uses_installation_tokens_and_replay_protection(self):
        source = self.read("app/api/v1/market-data/ingest/route.ts")
        self.assertIn("x-mt5-timestamp", source)
        self.assertIn("x-mt5-nonce", source)
        self.assertIn("mt5_ingest_nonces", source)
        self.assertIn("token_hash", source)
        self.assertIn("mt5_market_candles", source)
        self.assertIn("on_conflict=installation_id,symbol,timeframe,bar_time", source)
        self.assertIn("installation.status", source)

    def test_legacy_shared_secret_macro_signal_is_browser_same_origin_only(self):
        source = self.read("app/api/v1/macro-signal/route.ts")
        self.assertIn("isSameOriginBrowserRequest", source)
        self.assertNotIn("isAlgoAuthorized", source)
        self.assertNotIn("ALGO_PRIVATE_API_KEY", source)

    def test_personal_ea_lab_contains_no_customer_checkout_or_license_ui(self):
        store = self.read("app/store/page.tsx")
        terminal = self.read("app/components/StoreTerminal.tsx")
        owner = self.read("app/owner/OwnerOperations.tsx")
        self.assertIn("StoreTerminal", store)
        self.assertNotIn("LegacyStoreTerminal", store)
        self.assertNotIn("Paystack", terminal)
        self.assertNotIn("Checkout", terminal)
        self.assertNotIn("license_key", terminal)
        self.assertIn("QuantSupervisor.mqh", terminal)
        self.assertIn("GHOST PROTOCOL", terminal)
        self.assertNotIn("OwnerControlPlane", owner)
        self.assertNotIn("id: 'platform'", owner)

    def test_personal_policy_and_ghost_gate_are_fail_closed(self):
        policy = self.read("lib/riskPolicy.ts")
        ghost = self.read("lib/quantRisk.ts")
        signal = self.read("lib/signalEngine.ts")
        self.assertIn("executionEnabled: false", policy)
        self.assertIn("modelValidated: false", policy)
        self.assertIn("maxPerTradeRiskPct: 1.0", policy)
        self.assertIn("maxHighWaterDrawdownPct: 15.0", policy)
        self.assertIn("maxConsecutiveLosses: 3", policy)
        self.assertIn("GHOST_PROTOCOL_THRESHOLD = 0.65", ghost)
        self.assertIn("safeToTrade = riskBudget.approved && ghost.allowed", signal)
        self.assertIn("quoteAgeMs <= personalRiskPolicy.maxQuoteAgeMs", signal)

    def test_mt5_publisher_and_historical_backfill_are_read_only(self):
        publisher = self.read("scripts/mt5_market_publisher.py")
        backfill = self.read("scripts/mt5_historical_backfill.py")
        supervisor = self.read("public/downloads/QuantSupervisor.mqh")
        self.assertIn("FIDULYNC_INGEST_URL", publisher)
        self.assertIn("copy_rates_from_pos", publisher)
        self.assertIn("copy_rates_range", backfill)
        self.assertIn("MT5_BACKFILL_START", backfill)
        self.assertIn("1996-01-01", backfill)
        self.assertNotIn("order_send", publisher)
        self.assertNotIn("order_send", backfill)
        self.assertIn("x-mt5-timestamp", supervisor)
        self.assertIn("x-mt5-nonce", supervisor)

    def test_secondary_customer_pages_redirect_to_private_owner_console(self):
        for page in ("app/account/page.tsx", "app/customer/page.tsx", "app/licensing/page.tsx"):
            with self.subTest(page=page):
                self.assertIn("redirect('/owner')", self.read(page))

    def test_personal_risk_policy_discloses_research_only_boundary(self):
        terms = self.read("app/terms/page.tsx")
        readme = self.read("README.md")
        self.assertIn("Personal Quant Edition", terms)
        self.assertIn("not investment advice", terms)
        self.assertIn("does not place, modify or close broker orders", terms)
        self.assertIn("FRED", terms)
        self.assertIn("Personal, non-commercial use only", readme)


if __name__ == "__main__":
    unittest.main()
