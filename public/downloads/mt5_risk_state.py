"""Pure helpers for deriving conservative MT5 account risk telemetry."""

from __future__ import annotations

from typing import Any, Iterable


def consecutive_closed_loss_streak(
    deals: Iterable[Any],
    open_position_ids: set[int],
    exit_entries: set[int],
) -> int:
    """Count newest consecutive losing *closed positions*, not individual deals.

    Net P&L includes profit, commission, swap and fee across all deals belonging
    to a position. Still-open positions are excluded until their final exit.
    """
    grouped: dict[int, dict[str, float]] = {}
    for deal in deals:
        position_id = int(getattr(deal, "position_id", 0) or 0)
        if position_id <= 0:
            continue
        item = grouped.setdefault(position_id, {"net": 0.0, "last_exit": 0.0})
        item["net"] += sum(
            float(getattr(deal, field, 0.0) or 0.0)
            for field in ("profit", "commission", "swap", "fee")
        )
        if int(getattr(deal, "entry", -1)) in exit_entries:
            exit_time = float(getattr(deal, "time_msc", 0) or 0) / 1000.0
            if exit_time <= 0:
                exit_time = float(getattr(deal, "time", 0) or 0)
            item["last_exit"] = max(item["last_exit"], exit_time)

    closed = [
        (item["last_exit"], item["net"])
        for position_id, item in grouped.items()
        if position_id not in open_position_ids and item["last_exit"] > 0
    ]
    closed.sort(key=lambda item: item[0], reverse=True)
    streak = 0
    for _, net_profit in closed:
        if net_profit < 0:
            streak += 1
        else:
            break
    return streak
