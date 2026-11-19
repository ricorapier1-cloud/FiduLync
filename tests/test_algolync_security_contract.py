from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class AlgoLyncSecurityContractTests(unittest.TestCase):
    def read(self, path: str) -> str:
        return (ROOT / path).read_text(encoding="utf-8")

    def test_public_license_endpoints_use_distributed_fail_closed_limits(self):
        routes = (
            "app/api/v1/validate-license/route.ts",
            "app/api/v1/bind-account/route.ts",
            "app/api/v1/provision-demo-license/route.ts",
            "app/api/owner/verify/route.ts",
        )
        for route in routes:
            with self.subTest(route=route):
                source = self.read(route)
                self.assertIn("enforceDistributedRateLimit", source)
                self.assertIn("rate.unavailable", source)
                self.assertNotIn("checkRateLimit(", source)

    def test_rate_limiter_uses_trusted_proxy_ip_and_durable_rpc(self):
        source = self.read("lib/rateLimit.ts")
        self.assertIn("x-real-ip", source)
        self.assertNotIn("x-forwarded-for", source)
        self.assertIn("/rest/v1/rpc/consume_api_rate_limit", source)
        self.assertIn("unavailable: true", source)
        migration = self.read("supabase/migrations/20261119120000_durable_api_sliding_window_rate_limit.sql")
        self.assertIn("pg_advisory_xact_lock", migration)
        self.assertIn("occurred_at", migration)
        self.assertIn("GRANT EXECUTE", migration)

    def test_license_validation_has_no_demo_prefix_or_local_development_bypass(self):
        source = self.read("app/api/v1/validate-license/route.ts")
        self.assertIn("ea_license_seats", source)
        self.assertIn("rpc/bind_algolync_seat", source)
        self.assertIn("account_type", source)
        self.assertIn("DEMO_14D", source)
        self.assertNotIn("LOCAL_DEV", source)
        self.assertNotIn("startsWith('ALGO-DEMO')", source)

    def test_account_binding_uses_atomic_server_side_rebind_rpc(self):
        source = self.read("app/api/v1/bind-account/route.ts")
        self.assertIn("rpc/bind_algolync_seat", source)
        self.assertIn("previous_account_number", source)
        migration = self.read("supabase/migrations/20261119121500_atomic_algolync_seat_binding.sql")
        self.assertIn("interval '72 hours'", migration)
        self.assertIn("FOR UPDATE", migration)
        self.assertIn("included_live_seats", migration)
        self.assertIn("included_demo_seats", migration)

    def test_demo_provisioning_is_persisted_and_demo_only(self):
        source = self.read("app/api/v1/provision-demo-license/route.ts")
        self.assertIn("persistLicense", source)
        self.assertIn("isSupabaseConfigured", source)
        self.assertIn("included_live_seats: 0", source)
        self.assertIn("included_demo_seats: 2", source)
        catalog = self.read("components/QuantStrategyCatalog.tsx")
        self.assertNotIn("-PREVIEW", catalog)
        self.assertNotIn("-OFFLINE", catalog)
        self.assertIn("No license key was issued", catalog)

    def test_payments_use_database_pricing_and_exact_amount_before_minting(self):
        checkout = self.read("app/api/v1/create-checkout/route.ts")
        provision = self.read("lib/provisionLicense.ts")
        self.assertIn("one_time_price_ngn", checkout)
        self.assertIn("one_time_price_usd", checkout)
        self.assertIn("ALGO_${eaSlug}_${plan}_${currency}", checkout)
        self.assertIn("paidAmount !== expectedAmount", provision)
        self.assertIn("rpc/provision_algolync_license_v2", provision)
        self.assertNotIn("persisted || candidate", provision)

    def test_storefront_and_risk_disclosure_are_canonical(self):
        store = self.read("app/store/page.tsx")
        licensing = self.read("app/licensing/page.tsx")
        terms = self.read("app/terms/page.tsx")
        self.assertIn("LegacyStoreTerminal", store)
        self.assertIn("redirect('/store')", licensing)
        self.assertIn("Backtests, simulated results and live verified telemetry", terms)
        self.assertIn("72-hour cooldown", terms)
        self.assertIn("high level of risk", terms)

    def test_mql5_client_sends_actual_account_mode(self):
        source = self.read("mql5/MacroLyncLicense.mqh")
        self.assertIn("ACCOUNT_TRADE_MODE", source)
        self.assertIn("account_number", source)
        self.assertIn("account_type", source)


if __name__ == "__main__":
    unittest.main()
