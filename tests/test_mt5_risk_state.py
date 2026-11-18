import unittest
from types import SimpleNamespace

from scripts.mt5_risk_state import consecutive_closed_loss_streak


OUT = 1
OUT_BY = 3
INOUT = 2


def deal(position_id, entry, timestamp, profit, commission=0, swap=0, fee=0):
    return SimpleNamespace(
        position_id=position_id, entry=entry, time_msc=timestamp * 1000,
        profit=profit, commission=commission, swap=swap, fee=fee,
    )


class ConsecutiveClosedLossTests(unittest.TestCase):
    def test_counts_newest_losses_until_first_non_loss(self):
        deals = [
            deal(10, OUT, 100, -12),
            deal(11, OUT, 200, -8),
            deal(12, OUT, 300, -5),
            deal(13, OUT, 400, 4),
            deal(14, OUT, 500, -3),
        ]
        self.assertEqual(consecutive_closed_loss_streak(deals, set(), {OUT, OUT_BY, INOUT}), 3)

    def test_excludes_still_open_positions(self):
        deals = [deal(10, OUT, 100, -10), deal(11, OUT, 200, -5)]
        self.assertEqual(consecutive_closed_loss_streak(deals, {11}, {OUT, OUT_BY, INOUT}), 1)

    def test_aggregates_partial_closes_and_all_costs_by_position(self):
        deals = [
            deal(10, 0, 50, 0, commission=-1),
            deal(10, OUT, 100, 3, commission=-1, swap=-2, fee=-1),
            deal(10, OUT_BY, 110, 1, commission=-1),
        ]
        # Total net is -2, so the fully closed position is a loss.
        self.assertEqual(consecutive_closed_loss_streak(deals, set(), {OUT, OUT_BY, INOUT}), 1)

    def test_ignores_positions_without_a_final_exit(self):
        deals = [deal(10, 0, 50, -100)]
        self.assertEqual(consecutive_closed_loss_streak(deals, set(), {OUT, OUT_BY, INOUT}), 0)

    def test_breaks_streak_on_zero_or_positive_net(self):
        deals = [deal(10, OUT, 100, -1), deal(11, OUT, 200, 0), deal(12, OUT, 300, -9)]
        self.assertEqual(consecutive_closed_loss_streak(deals, set(), {OUT, OUT_BY, INOUT}), 1)


if __name__ == "__main__":
    unittest.main()
