"""
FiduLync MT5 market-data publisher.

Runs on the same Windows VPS/PC as an already logged-in MetaTrader 5 terminal.
It reads public market data only; it does not place trades or collect broker passwords.

Install:
    py -m pip install MetaTrader5
Run:
    set FIDULYNC_PUBLISHER_TOKEN=flmt5_...
    set MT5_SYMBOL_MAP=EURUSD=EURUSD,GBPUSD=GBPUSD,USDJPY=USDJPY,XAUUSD=XAUUSD
    py scripts/mt5_market_publisher.py

For broker suffixes, map canonical symbols to broker symbols, for example:
    MT5_SYMBOL_MAP=EURUSD=EURUSD.a,GBPUSD=GBPUSD.a,USDJPY=USDJPY.a,XAUUSD=XAUUSD.a
"""

from __future__ import annotations

import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import MetaTrader5 as mt5
except ImportError as exc:
    raise SystemExit(
        "MetaTrader5 Python package is missing. Install it with: py -m pip install MetaTrader5"
    ) from exc


DEFAULT_SYMBOL_MAP = {
    "EURUSD": "EURUSD",
    "GBPUSD": "GBPUSD",
    "USDJPY": "USDJPY",
    "XAUUSD": "XAUUSD",
}
TIMEFRAMES = {
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}
HISTORY_BARS = max(200, min(500, int(os.getenv("MT5_HISTORY_BARS", "200"))))
INTERVAL_SECONDS = max(15, int(os.getenv("MT5_PUBLISH_INTERVAL_SECONDS", "60")))
INGEST_URL = os.getenv(
    "FIDULYNC_INGEST_URL",
    "https://fidulync.vercel.app/api/v1/market-data/ingest",
).strip()
PUBLISHER_TOKEN = os.getenv("FIDULYNC_PUBLISHER_TOKEN", "").strip()
TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH", "").strip()
SYMBOL_MAP_TEXT = os.getenv("MT5_SYMBOL_MAP", "").strip()


def utc_iso(epoch_seconds: float) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_symbol_map() -> dict[str, str]:
    if not SYMBOL_MAP_TEXT:
        return DEFAULT_SYMBOL_MAP.copy()
    mapping: dict[str, str] = {}
    for entry in SYMBOL_MAP_TEXT.split(","):
        canonical, separator, broker_symbol = entry.strip().partition("=")
        canonical = canonical.strip().upper()
        broker_symbol = broker_symbol.strip()
        if not separator or not canonical or not broker_symbol:
            raise SystemExit("Invalid MT5_SYMBOL_MAP. Use CANONICAL=BROKER_SYMBOL comma-separated pairs.")
        if canonical not in DEFAULT_SYMBOL_MAP:
            raise SystemExit(f"Unsupported canonical symbol: {canonical}")
        mapping[canonical] = broker_symbol
    missing = set(DEFAULT_SYMBOL_MAP) - set(mapping)
    if missing:
        raise SystemExit(f"MT5_SYMBOL_MAP is missing: {', '.join(sorted(missing))}")
    return mapping


SYMBOL_MAP = parse_symbol_map()


def initialize_terminal() -> None:
    initialized = mt5.initialize(TERMINAL_PATH) if TERMINAL_PATH else mt5.initialize()
    if not initialized:
        raise RuntimeError(f"MetaTrader 5 initialization failed: {mt5.last_error()}")
    terminal = mt5.terminal_info()
    account = mt5.account_info()
    if terminal is None or account is None or not terminal.connected:
        mt5.shutdown()
        raise RuntimeError("MT5 terminal is not connected to a broker account. Log in to MT5 on this VPS first.")
    print(f"Connected to MT5 terminal: {terminal.name}; broker server: {account.server}")


def ensure_symbols() -> dict[str, Any]:
    infos: dict[str, Any] = {}
    for canonical, broker_symbol in SYMBOL_MAP.items():
        if not mt5.symbol_select(broker_symbol, True):
            print(f"WARNING: cannot select {broker_symbol}: {mt5.last_error()}")
            continue
        info = mt5.symbol_info(broker_symbol)
        if info is None:
            print(f"WARNING: symbol metadata unavailable for {broker_symbol}")
            continue
        infos[canonical] = info
    return infos


def build_quotes(infos: dict[str, Any], account: Any) -> list[dict[str, Any]]:
    quotes: list[dict[str, Any]] = []
    for canonical, broker_symbol in SYMBOL_MAP.items():
        info = infos.get(canonical)
        if info is None:
            continue
        tick = mt5.symbol_info_tick(broker_symbol)
        if tick is None or tick.bid <= 0 or tick.ask < tick.bid or tick.time_msc <= 0:
            continue
        point = float(info.point or 0)
        spread_points = (float(tick.ask) - float(tick.bid)) / point if point > 0 else 0.0
        quotes.append({
            "symbol": canonical,
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "quote_time": utc_iso(float(tick.time_msc) / 1000.0),
            "spread_points": round(max(0.0, spread_points), 2),
            "digits": int(info.digits),
            "point": point,
            "tick_size": float(info.trade_tick_size),
            "tick_value": float(info.trade_tick_value),
            "contract_size": float(info.trade_contract_size),
            "broker": str(account.company or "")[:100],
            "server": str(account.server or "")[:120],
        })
    return quotes


def build_candles(
    timeframe_name: str,
    timeframe_value: int,
    infos: dict[str, Any],
    last_sent: dict[tuple[str, str], int],
) -> tuple[list[dict[str, Any]], dict[tuple[str, str], int]]:
    candles: list[dict[str, Any]] = []
    pending: dict[tuple[str, str], int] = {}
    for canonical, broker_symbol in SYMBOL_MAP.items():
        info = infos.get(canonical)
        if info is None:
            continue
        # start_pos=1 excludes the currently forming candle; publish closed bars only.
        rates = mt5.copy_rates_from_pos(broker_symbol, timeframe_value, 1, HISTORY_BARS)
        if rates is None or len(rates) < 200:
            print(f"WARNING: {canonical} {timeframe_name} has fewer than 200 closed bars.")
            continue
        key = (canonical, timeframe_name)
        sent_time = last_sent.get(key, 0)
        new_rates = [rate for rate in rates if int(rate["time"]) > sent_time]
        if not new_rates:
            continue
        for rate in new_rates:
            candles.append({
                "symbol": canonical,
                "timeframe": timeframe_name,
                "bar_time": utc_iso(float(rate["time"])),
                "open": float(rate["open"]),
                "high": float(rate["high"]),
                "low": float(rate["low"]),
                "close": float(rate["close"]),
                "tick_volume": int(rate["tick_volume"]),
                "spread_points": float(rate["spread"]),
                "real_volume": int(rate["real_volume"]),
                "is_closed": True,
                "digits": int(info.digits),
                "point": float(info.point),
                "tick_size": float(info.trade_tick_size),
                "tick_value": float(info.trade_tick_value),
                "contract_size": float(info.trade_contract_size),
            })
        pending[key] = int(new_rates[-1]["time"])
    return candles, pending


def build_account_snapshot(account: Any, infos: dict[str, Any]) -> dict[str, Any]:
    equity = float(account.equity)
    open_risk_cash = 0.0
    risk_verified = True
    positions = mt5.positions_get()
    if positions is None:
        positions = ()
        risk_verified = False
    for position in positions:
        info = mt5.symbol_info(position.symbol)
        tick_size = float(getattr(info, "trade_tick_size", 0) or 0) if info else 0.0
        tick_value = float(getattr(info, "trade_tick_value", 0) or 0) if info else 0.0
        stop_loss = float(getattr(position, "sl", 0) or 0)
        open_price = float(getattr(position, "price_open", 0) or 0)
        volume = float(getattr(position, "volume", 0) or 0)
        if tick_size <= 0 or tick_value <= 0 or stop_loss <= 0 or open_price <= 0 or volume <= 0:
            risk_verified = False
            open_risk_cash = max(open_risk_cash, equity)
            continue
        distance_ticks = abs(open_price - stop_loss) / tick_size
        open_risk_cash += distance_ticks * tick_value * volume

    return {
        "account_login": int(account.login),
        "currency": str(account.currency or "USD").upper(),
        "balance": float(account.balance),
        "equity": equity,
        "margin": float(account.margin),
        "free_margin": float(account.margin_free),
        "margin_level": float(account.margin_level or 0),
        "open_positions": len(positions),
        "open_risk_cash": min(max(0.0, open_risk_cash), max(equity, open_risk_cash)),
        "open_risk_verified": risk_verified,
        "broker": str(account.company or "")[:100],
        "server": str(account.server or "")[:120],
        "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def post_batch(quotes: list[dict[str, Any]], candles: list[dict[str, Any]], account_snapshot: dict[str, Any] | None = None) -> None:
    if not quotes and not candles:
        return
    body = json.dumps({"quotes": quotes, "candles": candles, "account_snapshot": account_snapshot}, separators=(",", ":")).encode("utf-8")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    request = Request(
        INGEST_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {PUBLISHER_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-mt5-timestamp": now,
            "x-mt5-nonce": str(uuid.uuid4()),
        },
    )
    try:
        with urlopen(request, timeout=25) as response:
            payload = response.read().decode("utf-8", errors="replace")
            if response.status != 202:
                raise RuntimeError(f"Ingestion returned HTTP {response.status}: {payload[:300]}")
            result = json.loads(payload)
            print(
                f"Accepted: {result.get('quotes_received', 0)} quotes, "
                f"{result.get('candles_received', 0)} candles at {result.get('received_at_utc', now)}"
            )
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ingestion HTTP {exc.code}: {detail[:300]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Cannot reach FiduLync ingestion endpoint: {exc.reason}") from exc


def main() -> int:
    if not PUBLISHER_TOKEN.startswith("flmt5_") or len(PUBLISHER_TOKEN) < 40:
        print("Set FIDULYNC_PUBLISHER_TOKEN to the private token created in the FiduLync owner console.")
        return 2
    if not INGEST_URL.lower().startswith("https://"):
        print("FIDULYNC_INGEST_URL must use HTTPS.")
        return 2

    initialize_terminal()
    last_sent: dict[tuple[str, str], int] = {}
    try:
        while True:
            account = mt5.account_info()
            terminal = mt5.terminal_info()
            if account is None or terminal is None or not terminal.connected:
                print("MT5 disconnected. Reinitializing terminal...")
                mt5.shutdown()
                time.sleep(5)
                initialize_terminal()
                account = mt5.account_info()
            infos = ensure_symbols()
            if not infos:
                print("No configured broker symbols are available; retrying.")
                time.sleep(INTERVAL_SECONDS)
                continue

            quotes = build_quotes(infos, account)
            for index, (timeframe_name, timeframe_value) in enumerate(TIMEFRAMES.items()):
                candles, pending = build_candles(timeframe_name, timeframe_value, infos, last_sent)
                batch_quotes = quotes if index == 0 else []
                try:
                    post_batch(batch_quotes, candles, build_account_snapshot(account, infos) if index == 0 else None)
                    last_sent.update(pending)
                except Exception as exc:
                    print(f"Publish failed for {timeframe_name}: {exc}")
            time.sleep(INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("Publisher stopped by user.")
    finally:
        mt5.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
