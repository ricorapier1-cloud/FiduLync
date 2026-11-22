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

    def test_private_installation_provisioning_remains_server_authorized(self):
        owner_routes = (
            "app/api/owner/mt5-installations/route.ts",
            "app/api/mt5/installations/route.ts",
        )
        for route in owner_routes:
            with self.subTest(route=route):
                self.assertIn("requireOwner(request)", self.read(route))

    def test_macro_context_is_the_only_mt5_data_bridge(self):
        source = self.read("app/api/v1/macro-context/route.ts")
        self.assertIn("createHash('sha256')", source)
        self.assertIn("token_hash=eq.", source)
        self.assertIn("status=eq.active", source)
        self.assertIn("x-mt5-timestamp", source)
        self.assertIn("enforceDistributedRateLimit", source)
        self.assertIn("INSUFFICIENT_EVIDENCE", source)
        self.assertIn("Cache-Control", source)
        self.assertNotIn("OrderSend", source)

    def test_broker_ingestion_and_ea_supervisor_are_retired(self):
        routes = (
            "app/api/v1/market-data/ingest/route.ts",
            "app/api/v1/ea-supervisor/decision/route.ts",
        )
        for route in routes:
            with self.subTest(route=route):
                self.assertIn("status: 410", self.read(route))

    def test_legacy_macro_signal_is_retired_in_favour_of_fundamental_context(self):
        legacy = self.read("app/api/v1/macro-signal/route.ts")
        context = self.read("app/api/v1/macro-context/route.ts")
        self.assertIn("status: 410", legacy)
        self.assertIn("technical decisions belong inside independent MT5 EAs", legacy)
        self.assertIn("fundamental_bias", context)
        self.assertIn("high_impact_lockout", context)

    def test_browser_owner_console_is_removed_and_admin_apis_remain_protected(self):
        for path in (
            "app/owner/page.tsx",
            "app/owner/OwnerOperations.tsx",
            "app/owner/OwnerTradingDesk.tsx",
            "app/owner/OwnerResearchGovernance.tsx",
            "app/owner/OwnerArtifactRelease.tsx",
        ):
            with self.subTest(path=path):
                self.assertFalse((ROOT / path).exists())
        for route in (
            "app/api/owner/mt5-installations/route.ts",
            "app/api/owner/artifacts/upload-url/route.ts",
            "app/api/owner/artifacts/register/route.ts",
        ):
            with self.subTest(route=route):
                source = self.read(route)
                self.assertIn("requireOwner(request)", source)
        shell = self.read("components/PlatformShell.tsx")
        self.assertNotIn("href: '/owner'", shell)
        self.assertNotIn("Owner Console", shell)

    def test_personal_risk_policy_discloses_research_only_boundary(self):
        terms = self.read("app/terms/page.tsx")
        readme = self.read("README.md")
        self.assertIn("Personal Quant Edition", terms)
        self.assertIn("not investment advice", terms)
        self.assertIn("does not place, modify or close broker orders", terms)
        self.assertIn("FRED", terms)
        self.assertIn("No user login or owner-console interface", readme)


if __name__ == "__main__":
    unittest.main()
