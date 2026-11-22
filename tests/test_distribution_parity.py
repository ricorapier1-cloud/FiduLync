from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DistributionParityTests(unittest.TestCase):
    def test_macro_context_include_matches_public_download(self):
        source = ROOT / "MQL5/Include/FiduLync/MacroContextBridge.mqh"
        published = ROOT / "public/mql5/MacroContextBridge.mqh"
        self.assertEqual(source.read_bytes(), published.read_bytes())

    def test_macro_context_bridge_is_read_only_and_fails_closed(self):
        source = (ROOT / "MQL5/Include/FiduLync/MacroContextBridge.mqh").read_text(encoding="utf-8")
        self.assertIn("/api/v1/macro-context?symbol=", source)
        self.assertIn("Authorization: Bearer", source)
        self.assertIn("X-MT5-Timestamp", source)
        self.assertIn("INSUFFICIENT_EVIDENCE", source)
        self.assertIn("high_impact_lockout = true", source)
        self.assertNotIn("OrderSend", source)
        self.assertNotIn("CTrade", source)

    def test_obsolete_ea_store_and_license_downloads_are_not_public(self):
        obsolete = (
            "public/downloads/AlgoLync_EA_README.txt",
            "public/downloads/MacroLyncLicense.mqh",
            "public/downloads/QuantSupervisor.mqh",
            "public/downloads/FiduLync_MT5_Market_Publisher.py",
            "public/downloads/FiduLync_Supervisor_Probe.mq5",
            "public/mql5/MacroLyncBridge.mqh",
            "public/mql5/MacroLyncLicense.mqh",
        )
        for path in obsolete:
            with self.subTest(path=path):
                self.assertFalse((ROOT / path).exists(), f"Obsolete public artifact remains: {path}")


if __name__ == "__main__":
    unittest.main()
