from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]

DISTRIBUTION_PAIRS = (
    ("MQL5/Include/FiduLync/ExecutionTelemetry.mqh", "public/downloads/FiduLync_ExecutionTelemetry.mqh"),
    ("MQL5/Include/FiduLync/QuantSupervisor.mqh", "public/downloads/QuantSupervisor.mqh"),
    ("MQL5/Experts/FiduLync_Supervisor_Probe.mq5", "public/downloads/FiduLync_Supervisor_Probe.mq5"),
    ("scripts/mt5_market_publisher.py", "public/downloads/FiduLync_MT5_Market_Publisher.py"),
    ("scripts/mt5_risk_state.py", "public/downloads/mt5_risk_state.py"),
    ("mql5/MacroLyncLicense.mqh", "public/downloads/MacroLyncLicense.mqh"),
    ("mql5/MacroLyncLicense.mqh", "public/mql5/MacroLyncLicense.mqh"),
)


class DistributionParityTests(unittest.TestCase):
    def test_published_connector_files_match_reviewed_sources(self):
        for source, published in DISTRIBUTION_PAIRS:
            with self.subTest(source=source, published=published):
                self.assertEqual(
                    (ROOT / source).read_bytes(),
                    (ROOT / published).read_bytes(),
                    f"Published download is stale: {published}",
                )

    def test_supervisor_and_probe_contain_no_order_send_call(self):
        guarded_sources = (
            ROOT / "MQL5/Include/FiduLync/QuantSupervisor.mqh",
            ROOT / "MQL5/Experts/FiduLync_Supervisor_Probe.mq5",
            ROOT / "MQL5/Include/FiduLync/ExecutionTelemetry.mqh",
        )
        for path in guarded_sources:
            with self.subTest(path=path.relative_to(ROOT)):
                source = path.read_text(encoding="utf-8")
                self.assertIsNone(
                    re.search(r"\bOrderSend\s*\(", source),
                    f"Broker order submission found in read-only module: {path}",
                )


if __name__ == "__main__":
    unittest.main()
