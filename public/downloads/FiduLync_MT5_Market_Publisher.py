"""
FiduLync MT5 market-data publisher.

Runs on the same Windows VPS/PC as an already logged-in MetaTrader 5 terminal.
It reads public market data only; it does not place trades or collect broker passwords.

Install:
    py -m pip install MetaTrader5
Run:
    set FIDULYNC_INGEST_URL=https://fidulync.vercel.app/api/v1/market-data/ingest
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

from mt5_risk_state import consecutive_closed_loss_streak
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
    "USDCHF": "USDCHF",
    "USDCAD": "USDCAD",
    "AUDUSD": "AUDUSD",
    "NZDUSD": "NZDUSD",
    "EURJPY": "EURJPY",
    "XAUUSD": "XAUUSD",
}
OPTIONAL_SYMBOL_MAP = {
    "DXY": "DXY",
    "USOIL": "USOIL",
    "SPX500": "SPX500",
}
G10_CURRENCIES = ("USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK")
G10_CROSS_SYMBOLS = {base + quote for base in G10_CURRENCIES for quote in G10_CURRENCIES if base != quote}
SUPPORTED_SYMBOLS = set(DEFAULT_SYMBOL_MAP) | G10_CROSS_SYMBOLS | set(OPTIONAL_SYMBOL_MAP)
TIMEFRAMES = {
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
}
HISTORY_BARS = max(200, min(500, int(os.getenv("MT5_HISTORY_BARS", "200"))))
INTERVAL_SECONDS = max(1, min(5, int(os.getenv("MT5_PUBLISH_INTERVAL_SECONDS", "1"))))
CANDLE_REFRESH_SECONDS = max(10, int(os.getenv("MT5_CANDLE_REFRESH_SECONDS", "15")))
POSITION_REFRESH_SECONDS = max(3, int(os.getenv("MT5_POSITION_REFRESH_SECONDS", "5")))
LOSS_STREAK_REFRESH_SECONDS = max(15, min(25, int(os.getenv("MT5_LOSS_STREAK_REFRESH_SECONDS", "20"))))
_loss_streak_cache: tuple[int, str] | None = None
_loss_streak_last_attempt = 0.0
_execution_last_sync_epoch: float | None = None
_execution_seen_event_ids: set[str] = set()
# Deliberately require an explicit verified deployment URL. The production
# deployment may not yet contain the personal-quant account-snapshot endpoint.
INGEST_URL = os.getenv("FIDULYNC_INGEST_URL", "").strip()
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
        if canonical not in SUPPORTED_SYMBOLS:
            raise SystemExit(f"Unsupported canonical symbol: {canonical}")
        mapping[canonical] = broker_symbol
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
            "tick_value_loss": float(getattr(info, "trade_tick_value_loss", 0.0) or 0.0),
            "tick_value_profit": float(getattr(info, "trade_tick_value_profit", 0.0) or 0.0),
            "contract_size": float(info.trade_contract_size),
            "volume_min": float(info.volume_min),
            "volume_max": float(info.volume_max),
            "volume_step": float(info.volume_step),
            "stop_level_points": float(info.trade_stops_level),
            "margin_per_lot_buy": float(mt5.order_calc_margin(mt5.ORDER_TYPE_BUY, broker_symbol, 1.0, float(tick.ask)) or 0.0),
            "margin_per_lot_sell": float(mt5.order_calc_margin(mt5.ORDER_TYPE_SELL, broker_symbol, 1.0, float(tick.bid)) or 0.0),
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


def build_verified_loss_streak(positions: Any) -> tuple[int | None, bool, str | None]:
    """Return a recently reconciled loss streak; never mark stale or failed history verified."""
    global _loss_streak_cache, _loss_streak_last_attempt

    if positions is None:
        return None, False, None

    now_monotonic = time.monotonic()
    now_utc = datetime.now(timezone.utc)
    cached = _loss_streak_cache
    if cached is not None and now_monotonic - _loss_streak_last_attempt < LOSS_STREAK_REFRESH_SECONDS:
        synced_epoch, streak = cached
        age_seconds = now_utc.timestamp() - synced_epoch
        if 0 <= age_seconds <= LOSS_STREAK_REFRESH_SECONDS:
            synced_at = datetime.fromtimestamp(synced_epoch, tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
            return streak, True, synced_at

    _loss_streak_last_attempt = now_monotonic
    try:
        deals = mt5.history_deals_get(datetime(2000, 1, 1, tzinfo=timezone.utc), now_utc)
    except Exception as exc:
        _loss_streak_cache = None
        print(f"WARNING: MT5 closed-trade history unavailable: {exc}")
        return None, False, None
    if deals is None:
        _loss_streak_cache = None
        print(f"WARNING: MT5 history_deals_get failed: {mt5.last_error()}")
        return None, False, None

    open_position_ids = {
        int(getattr(position, "identifier", getattr(position, "ticket", 0)) or 0)
        for position in positions
    }
    exit_entries = {
        int(getattr(mt5, "DEAL_ENTRY_OUT", 1)),
        int(getattr(mt5, "DEAL_ENTRY_OUT_BY", 3)),
        int(getattr(mt5, "DEAL_ENTRY_INOUT", 2)),
    }
    consecutive_losses = consecutive_closed_loss_streak(deals, open_position_ids, exit_entries)
    synced_epoch = now_utc.timestamp()
    _loss_streak_cache = (synced_epoch, consecutive_losses)
    synced_at = now_utc.isoformat(timespec="seconds").replace("+00:00", "Z")
    return consecutive_losses, True, synced_at


def build_account_snapshot(account: Any, infos: dict[str, Any], positions_result: Any = None) -> dict[str, Any]:
    equity = float(account.equity)
    open_risk_cash = 0.0
    risk_verified = True
    if positions_result is None:
        positions_result = mt5.positions_get()
    positions = positions_result if positions_result is not None else ()
    if positions_result is None:
        risk_verified = False
    for position in positions:
        info = mt5.symbol_info(position.symbol)
        tick_size = float(getattr(info, "trade_tick_size", 0) or 0) if info else 0.0
        # Risk must use the broker's loss-side tick value, never the generic
        # or profit-side value. If unavailable, fail closed for the full account.
        tick_value_loss = float(getattr(info, "trade_tick_value_loss", 0) or 0) if info else 0.0
        stop_loss = float(getattr(position, "sl", 0) or 0)
        open_price = float(getattr(position, "price_open", 0) or 0)
        volume = float(getattr(position, "volume", 0) or 0)
        if tick_size <= 0 or tick_value_loss <= 0 or stop_loss <= 0 or open_price <= 0 or volume <= 0:
            risk_verified = False
            open_risk_cash = max(open_risk_cash, equity)
            continue
        distance_ticks = abs(open_price - stop_loss) / tick_size
        open_risk_cash += distance_ticks * tick_value_loss * volume

    consecutive_losses, loss_streak_verified, history_synced_at = build_verified_loss_streak(positions_result)
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
        "consecutive_losses": consecutive_losses,
        "loss_streak_verified": loss_streak_verified,
        "history_synced_at": history_synced_at,
        "broker": str(account.company or "")[:100],
        "server": str(account.server or "")[:120],
        "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def build_execution_events() -> tuple[list[dict[str, Any]], float | None]:
    """Read terminal-confirmed fills/closes; latency and requested-price slippage need EA hooks."""
    global _execution_last_sync_epoch
    now = datetime.now(timezone.utc)
    start_epoch = _execution_last_sync_epoch - 60 if _execution_last_sync_epoch is not None else now.timestamp() - 24 * 60 * 60
    try:
        deals = mt5.history_deals_get(datetime.fromtimestamp(start_epoch, tz=timezone.utc), now)
    except Exception as exc:
        print(f"WARNING: MT5 execution history unavailable: {exc}")
        return [], None
    if deals is None:
        print(f"WARNING: MT5 execution history query failed: {mt5.last_error()}")
        return [], None
    exit_entries = {int(getattr(mt5, "DEAL_ENTRY_OUT", 1)), int(getattr(mt5, "DEAL_ENTRY_OUT_BY", 3)), int(getattr(mt5, "DEAL_ENTRY_INOUT", 2))}
    buy_type = int(getattr(mt5, "DEAL_TYPE_BUY", 0))
    sell_type = int(getattr(mt5, "DEAL_TYPE_SELL", 1))
    events: list[dict[str, Any]] = []
    for deal in deals:
        ticket = int(getattr(deal, "ticket", 0) or 0)
        deal_type = int(getattr(deal, "type", -1))
        if ticket <= 0 or deal_type not in (buy_type, sell_type):
            continue
        event_id = str(ticket)
        if event_id in _execution_seen_event_ids:
            continue
        symbol = str(getattr(deal, "symbol", "") or "").upper()
        price = float(getattr(deal, "price", 0) or 0)
        volume = float(getattr(deal, "volume", 0) or 0)
        event_epoch = float(getattr(deal, "time_msc", 0) or 0) / 1000
        if not symbol or price <= 0 or volume <= 0 or event_epoch <= 0:
            continue
        entry = int(getattr(deal, "entry", -1))
        events.append({"event_id": event_id, "event_type": "DEAL_CLOSE" if entry in exit_entries else "FILL",
            "symbol": symbol, "side": "BUY" if deal_type == buy_type else "SELL",
            "fill_price": price, "volume": volume, "event_time": utc_iso(event_epoch),
            "broker_code": str(getattr(deal, "reason", "") or "")[:80]})
    events.sort(key=lambda item: item["event_time"])
    if len(events) > 500:
        events = events[:500]
        sync_epoch = datetime.fromisoformat(events[-1]["event_time"].replace("Z", "+00:00")).timestamp()
    else:
        sync_epoch = now.timestamp()
    return events, sync_epoch

def mark_execution_events_sent(events: list[dict[str, Any]], sync_epoch: float | None) -> None:
    global _execution_last_sync_epoch
    _execution_seen_event_ids.update(str(event["event_id"]) for event in events)
    if len(_execution_seen_event_ids) > 20_000:
        _execution_seen_event_ids.clear()
        _execution_seen_event_ids.update(str(event["event_id"]) for event in events)
    if sync_epoch is not None:
        _execution_last_sync_epoch = sync_epoch

def build_position_snapshot(account: Any, positions_result: Any) -> dict[str, Any] | None:
    """Build a complete point-in-time position set; None means do not publish."""
    if positions_result is None:
        return None
    if len(positions_result) > 500:
        print("WARNING: open-position count exceeds the 500-row snapshot limit; publishing risk telemetry without a complete position manifest.")
        return None
    captured_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    rows: list[dict[str, Any]] = []
    for position in positions_result:
        symbol = str(getattr(position, "symbol", "") or "")
        info = mt5.symbol_info(symbol)
        ticket = int(getattr(position, "ticket", 0) or 0)
        volume = float(getattr(position, "volume", 0) or 0)
        price_open = float(getattr(position, "price_open", 0) or 0)
        position_type = int(getattr(position, "type", -1))
        if not symbol or ticket <= 0 or volume <= 0 or price_open <= 0 or position_type not in (int(mt5.POSITION_TYPE_BUY), int(mt5.POSITION_TYPE_SELL)) or info is None:
            print("WARNING: incomplete position metadata; refusing to publish a complete snapshot.")
            return None
        rows.append({
            "position_ticket": ticket,
            "position_identifier": int(getattr(position, "identifier", 0) or 0) or None,
            "symbol": symbol.upper(),
            "side": "BUY" if position_type == int(mt5.POSITION_TYPE_BUY) else "SELL",
            "volume": volume,
            "price_open": price_open,
            "stop_loss": float(getattr(position, "sl", 0) or 0) or None,
            "take_profit": float(getattr(position, "tp", 0) or 0) or None,
            "profit_account_currency": float(getattr(position, "profit", 0) or 0),
            "contract_size": float(getattr(info, "trade_contract_size", 0) or 0) or None,
            "tick_size": float(getattr(info, "trade_tick_size", 0) or 0) or None,
            "tick_value_loss": float(getattr(info, "trade_tick_value_loss", 0) or 0) or None,
            "quote_currency": str(getattr(info, "currency_profit", "") or "").upper() or None,
            "base_currency": str(getattr(info, "currency_base", "") or "").upper() or None,
        })
    return {"snapshot_id": str(uuid.uuid4()), "captured_at": captured_at, "account_login": int(account.login), "expected_positions": len(rows), "positions": rows}

def post_batch(
    quotes: list[dict[str, Any]],
    candles: list[dict[str, Any]],
    account_snapshot: dict[str, Any] | None = None,
    position_snapshot: dict[str, Any] | None = None,
    execution_events: list[dict[str, Any]] | None = None,
) -> None:
    if not quotes and not candles and account_snapshot is None and position_snapshot is None and not execution_events:
        return
    # The API caps each request at 1,000 candles. Split broad FX universes safely,
    # sending the account snapshot and quotes only with the first chunk.
    chunks = [candles[index:index + 1_000] for index in range(0, len(candles), 1_000)] or [[]]
    for index, chunk in enumerate(chunks):
        batch_quotes = quotes if index == 0 else []
        batch_snapshot = account_snapshot if index == 0 else None
        body = json.dumps(
            {"quotes": batch_quotes, "candles": chunk, "account_snapshot": batch_snapshot, "position_snapshot": position_snapshot if index == 0 else None, "execution_events": execution_events if index == 0 else []},
            separators=(",", ":"),
        ).encode("utf-8")
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
            request_started = time.perf_counter()
            timeout_seconds = 5 if quotes or account_snapshot is not None or position_snapshot is not None else 15
            with urlopen(request, timeout=timeout_seconds) as response:
                payload = response.read().decode("utf-8", errors="replace")
                elapsed_ms = (time.perf_counter() - request_started) * 1000
                if response.status != 202:
                    raise RuntimeError(f"Ingestion returned HTTP {response.status}: {payload[:300]}")
                result = json.loads(payload)
                print(
                    f"Accepted: {result.get('quotes_received', 0)} quotes, "
                    f"{result.get('candles_received', 0)} candles, "
                    f"{result.get('positions_received', 0)} positions; "
                    f"snapshot complete={result.get('position_snapshot_complete', False)}; "
                    f"ingest RTT={elapsed_ms:.0f} ms at {result.get('received_at_utc', now)}"
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
    last_candle_refresh = 0.0
    last_position_refresh = 0.0
    try:
        while True:
            loop_started = time.monotonic()
            account = mt5.account_info()
            terminal = mt5.terminal_info()
            if account is None or terminal is None or not terminal.connected:
                print("MT5 disconnected. Reinitializing terminal...")
                mt5.shutdown()
                time.sleep(2)
                initialize_terminal()
                account = mt5.account_info()
            infos = ensure_symbols()
            if not infos:
                print("No configured broker symbols are available; retrying.")
                time.sleep(INTERVAL_SECONDS)
                continue

            # Keep the quote/account/position channel light and frequent.
            account_snapshot = None
            position_snapshot = None
            execution_events: list[dict[str, Any]] = []
            execution_sync_epoch: float | None = None
            now_monotonic = time.monotonic()
            if now_monotonic - last_position_refresh >= POSITION_REFRESH_SECONDS:
                positions_result = mt5.positions_get()
                account_snapshot = build_account_snapshot(account, infos, positions_result)
                position_snapshot = build_position_snapshot(account, positions_result)
                execution_events, execution_sync_epoch = build_execution_events()
            quotes = build_quotes(infos, account)
            try:
                post_batch(quotes, [], account_snapshot, position_snapshot, execution_events)
                if account_snapshot is not None:
                    last_position_refresh = time.monotonic()
                    mark_execution_events_sent(execution_events, execution_sync_epoch)
            except Exception as exc:
                print(f"Quote/account publish failed: {exc}")

            # Historical candles are heavier; refresh them on a separate cadence.
            now_monotonic = time.monotonic()
            if now_monotonic - last_candle_refresh >= CANDLE_REFRESH_SECONDS:
                for timeframe_name, timeframe_value in TIMEFRAMES.items():
                    candles, pending = build_candles(timeframe_name, timeframe_value, infos, last_sent)
                    try:
                        if candles:
                            post_batch([], candles)
                            last_sent.update(pending)
                    except Exception as exc:
                        print(f"Candle publish failed for {timeframe_name}: {exc}")
                last_candle_refresh = now_monotonic

            elapsed = time.monotonic() - loop_started
            time.sleep(max(0.1, INTERVAL_SECONDS - elapsed))
    except KeyboardInterrupt:
        print("Publisher stopped by user.")
    finally:
        mt5.shutdown()
    return 0

if __name__ == "__main__":
    sys.exit(main())
