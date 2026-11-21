"""
FiduLync MT5 historical candle backfill.

Personal-use, read-only market-data importer. It does not place trades, change
positions, read broker passwords, or publish account balances. It imports only
closed H1/H4/D1 candles that the connected broker terminal actually provides.

Run from the same Windows PC/VPS as the logged-in MT5 terminal:
    py -m pip install MetaTrader5
    set FIDULYNC_INGEST_URL=https://fidulync.vercel.app/api/v1/market-data/ingest
    set FIDULYNC_PUBLISHER_TOKEN=flmt5_...
    set MT5_SYMBOL_MAP=EURUSD=EURUSD.a,GBPUSD=GBPUSD.a,USDJPY=USDJPY.a,XAUUSD=XAUUSD.a
    set MT5_BACKFILL_START=1996-01-01
    py scripts/mt5_historical_backfill.py

MT5 must have sufficient history available. In MT5, set Tools -> Options ->
Charts -> Max bars in chart to a suitably high value (for example 1,000,000),
then allow the terminal to download broker history. Actual coverage depends on
the broker. The script reports gaps and the first/last real bar; it never
fabricates candles to fill missing history.

The API upserts by installation/symbol/timeframe/bar time, so reruns are
idempotent. Start with one symbol and H1, inspect ingestion and storage, then
expand the universe/timeframes.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
import uuid
from datetime import date, datetime, time as day_time, timedelta, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import MetaTrader5 as mt5
except ImportError as exc:
    raise SystemExit(
        "MetaTrader5 package is missing. Install it with: py -m pip install MetaTrader5"
    ) from exc


DEFAULT_SYMBOL_MAP = {
    "EURUSD": "EURUSD",
    "GBPUSD": "GBPUSD",
    "USDJPY": "USDJPY",
    "USDCHF": "USDCHF",
    "USDCAD": "USDCAD",
    "AUDUSD": "AUDUSD",
    "NZDUSD": "NZDUSD",
    "EURJPY": "EURJPY",
    "XAUUSD": "XAUUSD",
}
G10_CURRENCIES = ("USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK")
G10_CROSS_SYMBOLS = {base + quote for base in G10_CURRENCIES for quote in G10_CURRENCIES if base != quote}
SUPPORTED_SYMBOLS = set(DEFAULT_SYMBOL_MAP) | G10_CROSS_SYMBOLS | {"XAGUSD", "DXY", "USOIL", "SPX500"}
TIMEFRAMES = {
    "H1": (mt5.TIMEFRAME_H1, 3600),
    "H4": (mt5.TIMEFRAME_H4, 14400),
    "D1": (mt5.TIMEFRAME_D1, 86400),
}

INGEST_URL = os.getenv("FIDULYNC_INGEST_URL", "").strip()
PUBLISHER_TOKEN = os.getenv("FIDULYNC_PUBLISHER_TOKEN", "").strip()
TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH", "").strip()
SYMBOL_MAP_TEXT = os.getenv("MT5_SYMBOL_MAP", "").strip()
START_TEXT = os.getenv("MT5_BACKFILL_START", "1996-01-01").strip()
END_TEXT = os.getenv("MT5_BACKFILL_END", "").strip()
SYMBOLS_TEXT = os.getenv("MT5_BACKFILL_SYMBOLS", "").strip()
TIMEFRAMES_TEXT = os.getenv("MT5_BACKFILL_TIMEFRAMES", "H1,H4,D1").strip()
CHUNK_DAYS = max(30, min(365, int(os.getenv("MT5_BACKFILL_CHUNK_DAYS", "90"))))
BATCH_SIZE = max(100, min(1000, int(os.getenv("MT5_BACKFILL_BATCH_SIZE", "1000"))))
REQUEST_PAUSE = max(0.55, float(os.getenv("MT5_BACKFILL_REQUEST_PAUSE", "0.75")))


def parse_date(value: str, label: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit(f"{label} must use YYYY-MM-DD format.") from exc


def parse_symbol_map() -> dict[str, str]:
    if not SYMBOL_MAP_TEXT:
        return DEFAULT_SYMBOL_MAP.copy()
    mapping: dict[str, str] = {}
    for entry in SYMBOL_MAP_TEXT.split(","):
        canonical, separator, broker_symbol = entry.strip().partition("=")
        canonical = canonical.strip().upper()
        broker_symbol = broker_symbol.strip()
        if not separator or canonical not in SUPPORTED_SYMBOLS or not broker_symbol:
            raise SystemExit("Invalid MT5_SYMBOL_MAP. Use CANONICAL=BROKER_SYMBOL pairs.")
        mapping[canonical] = broker_symbol
    if not mapping:
        raise SystemExit("MT5_SYMBOL_MAP did not contain any symbols.")
    return mapping


def selected_symbols(mapping: dict[str, str]) -> list[str]:
    if not SYMBOLS_TEXT:
        return list(mapping)
    selected = [item.strip().upper() for item in SYMBOLS_TEXT.split(",") if item.strip()]
    unknown = sorted(set(selected) - set(mapping))
    if unknown:
        raise SystemExit(f"Backfill symbols are not mapped: {', '.join(unknown)}")
    return selected


def selected_timeframes() -> list[str]:
    names = [item.strip().upper() for item in TIMEFRAMES_TEXT.split(",") if item.strip()]
    if not names or any(name not in TIMEFRAMES for name in names):
        raise SystemExit("MT5_BACKFILL_TIMEFRAMES must be a comma-separated subset of H1,H4,D1.")
    return names


def utc_iso(epoch_seconds: float) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def initialize_terminal() -> None:
    initialized = mt5.initialize(TERMINAL_PATH) if TERMINAL_PATH else mt5.initialize()
    if not initialized:
        raise RuntimeError(f"MetaTrader 5 initialization failed: {mt5.last_error()}")
    terminal = mt5.terminal_info()
    account = mt5.account_info()
    if terminal is None or account is None or not terminal.connected:
        mt5.shutdown()
        raise RuntimeError("MT5 is not connected. Log in to the intended broker terminal first.")
    print(f"Connected to terminal {terminal.name}; broker server {account.server}.")


def make_candle(symbol: str, timeframe: str, seconds: int, rate: Any, now_epoch: int) -> dict[str, Any] | None:
    bar_epoch = int(rate["time"])
    if bar_epoch <= 0 or bar_epoch + seconds > now_epoch:
        return None
    values = [float(rate[key]) for key in ("open", "high", "low", "close")]
    if not all(math.isfinite(value) and value > 0 for value in values):
        return None
    open_price, high_price, low_price, close_price = values
    if high_price < low_price or not (low_price <= open_price <= high_price) or not (low_price <= close_price <= high_price):
        return None
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "bar_time": utc_iso(bar_epoch),
        "open": open_price,
        "high": high_price,
        "low": low_price,
        "close": close_price,
        "tick_volume": int(rate["tick_volume"]),
        "spread_points": float(rate["spread"]),
        "real_volume": int(rate["real_volume"]),
        "is_closed": True,
    }


def send_batch(candles: list[dict[str, Any]]) -> None:
    if not candles:
        return
    body = json.dumps({"quotes": [], "candles": candles}, separators=(",", ":")).encode("utf-8")
    for attempt in range(5):
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
            with urlopen(request, timeout=30) as response:
                payload = response.read().decode("utf-8", errors="replace")
                if response.status != 202:
                    raise RuntimeError(f"Ingestion returned HTTP {response.status}: {payload[:400]}")
                result = json.loads(payload)
                accepted = int(result.get("candles_received", 0))
                if accepted != len(candles):
                    raise RuntimeError(f"Server accepted {accepted} of {len(candles)} candles: {payload[:400]}")
                print(f"Accepted {accepted} closed candles; server received at {result.get('received_at_utc', now)}.")
                time.sleep(REQUEST_PAUSE)
                return
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise RuntimeError(f"Ingestion HTTP {exc.code}: {detail[:400]}") from exc
            retry_after = exc.headers.get("Retry-After", "")
            delay = float(retry_after) if retry_after.isdigit() else min(30.0, 2.0 ** attempt)
            print(f"Temporary HTTP {exc.code}; retrying in {delay:.1f}s.")
            time.sleep(delay)
        except URLError as exc:
            if attempt == 4:
                raise RuntimeError(f"Cannot reach FiduLync ingestion endpoint: {exc.reason}") from exc
            delay = min(30.0, 2.0 ** attempt)
            print(f"Network error; retrying in {delay:.1f}s.")
            time.sleep(delay)


def backfill_symbol_timeframe(
    canonical: str,
    broker_symbol: str,
    timeframe_name: str,
    timeframe_value: int,
    timeframe_seconds: int,
    start_utc: datetime,
    end_utc: datetime,
) -> tuple[int, str | None, str | None]:
    if not mt5.symbol_select(broker_symbol, True):
        print(f"WARNING {canonical}: broker symbol {broker_symbol} unavailable: {mt5.last_error()}")
        return 0, None, None

    now_epoch = int(datetime.now(timezone.utc).timestamp())
    chunk_start = start_utc
    total = 0
    first_seen: str | None = None
    last_seen: str | None = None

    while chunk_start < end_utc:
        chunk_end = min(chunk_start + timedelta(days=CHUNK_DAYS), end_utc)
        query_end = chunk_end - timedelta(seconds=1)
        rates = mt5.copy_rates_range(broker_symbol, timeframe_value, chunk_start, query_end)
        if rates is None:
            print(f"WARNING {canonical} {timeframe_name} {chunk_start.date()}..{chunk_end.date()}: {mt5.last_error()}")
            chunk_start = chunk_end
            continue

        candles: list[dict[str, Any]] = []
        for rate in rates:
            candle = make_candle(canonical, timeframe_name, timeframe_seconds, rate, now_epoch)
            if candle is not None:
                candles.append(candle)
        candles.sort(key=lambda item: item["bar_time"])

        for index in range(0, len(candles), BATCH_SIZE):
            batch = candles[index:index + BATCH_SIZE]
            send_batch(batch)
            total += len(batch)
            if first_seen is None and batch:
                first_seen = batch[0]["bar_time"]
            if batch:
                last_seen = batch[-1]["bar_time"]

        print(
            f"{canonical} {timeframe_name} {chunk_start.date()}..{chunk_end.date()}: "
            f"{len(rates)} broker bars, {len(candles)} closed valid bars."
        )
        chunk_start = chunk_end

    return total, first_seen, last_seen


def main() -> int:
    if not INGEST_URL.lower().startswith("https://") or not INGEST_URL.endswith("/api/v1/market-data/ingest"):
        raise SystemExit("Set FIDULYNC_INGEST_URL to the exact HTTPS /api/v1/market-data/ingest endpoint.")
    if not PUBLISHER_TOKEN.startswith("flmt5_") or len(PUBLISHER_TOKEN) < 40:
        raise SystemExit("Set FIDULYNC_PUBLISHER_TOKEN to the one-time token from the private Owner Console.")

    start_date = parse_date(START_TEXT, "MT5_BACKFILL_START")
    end_date = parse_date(END_TEXT, "MT5_BACKFILL_END") if END_TEXT else datetime.now(timezone.utc).date()
    if end_date < start_date:
        raise SystemExit("MT5_BACKFILL_END must not be earlier than MT5_BACKFILL_START.")

    start_utc = datetime.combine(start_date, day_time.min, tzinfo=timezone.utc)
    end_utc = datetime.combine(end_date + timedelta(days=1), day_time.min, tzinfo=timezone.utc)
    mapping = parse_symbol_map()
    symbols = selected_symbols(mapping)
    timeframes = selected_timeframes()

    initialize_terminal()
    try:
        for canonical in symbols:
            broker_symbol = mapping[canonical]
            for timeframe_name in timeframes:
                timeframe_value, timeframe_seconds = TIMEFRAMES[timeframe_name]
                total, first_seen, last_seen = backfill_symbol_timeframe(
                    canonical, broker_symbol, timeframe_name, timeframe_value,
                    timeframe_seconds, start_utc, end_utc,
                )
                print(
                    f"SUMMARY {canonical} {timeframe_name}: {total} accepted; "
                    f"first={first_seen or 'NO DATA'}; last={last_seen or 'NO DATA'}."
                )
    finally:
        mt5.shutdown()

    print("Historical backfill completed. Review actual coverage and gaps in FiduLync before research.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
