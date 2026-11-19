# FiduLync MT5 execution telemetry integration

This is a read-only evidence bridge. It never submits, modifies or closes broker orders.

## Files
- Include: `MQL5/Include/FiduLync/ExecutionTelemetry.mqh`
- Download copy: `/downloads/FiduLync_ExecutionTelemetry.mqh`

## Integration in an existing EA

Add the include and one global instance:

```mql5
#include <FiduLync/ExecutionTelemetry.mqh>
CFiduLyncExecutionTelemetry FiduLyncTelemetry;
```

In the EA's existing `OnInit()`, configure it with the production base URL and the private publisher token from the owner console, then start a five-second timer:

```mql5
FiduLyncTelemetry.Configure("https://fidulync.vercel.app", InpPublisherToken, 5000);
EventSetTimer(5);
```

In the EA's existing `OnTimer()` (do not create a second handler), flush queued evidence:

```mql5
FiduLyncTelemetry.Flush();
```

In the EA's existing `OnTradeTransaction()`, capture broker-confirmed deals:

```mql5
FiduLyncTelemetry.CaptureTradeTransaction(trans, request, result);
```

In `OnDeinit()`, stop the timer with `EventKillTimer()`.

## Requested-price and latency evidence

For the best slippage and latency measurements, after an EA's existing `OrderSend()` returns successfully, register its request context using `result.request_id`, the exact request symbol/side/price and the spread observed immediately before sending:

```mql5
if(OrderSend(request, result) && result.retcode == TRADE_RETCODE_DONE)
{
   double spreadPoints = (SymbolInfoDouble(request.symbol, SYMBOL_ASK)
                         - SymbolInfoDouble(request.symbol, SYMBOL_BID))
                         / SymbolInfoDouble(request.symbol, SYMBOL_POINT);
   FiduLyncTelemetry.RegisterOrderRequest(result.request_id, request.symbol,
      (request.type == ORDER_TYPE_BUY ? "BUY" : "SELL"), request.price, spreadPoints);
}
```

Adapt that snippet to the EA's existing order wrapper and preserve its current trade logic. For market execution, capture the requested price before the send; some brokers require a zero request price, in which case requested-price/slippage evidence may remain unavailable. Latency is only measured when the request context can be matched to the resulting transaction.

## MT5 terminal setup

1. Add `https://fidulync.vercel.app` to MT5 Tools → Options → Expert Advisors → Allow WebRequest for listed URL.
2. Compile the EA and include in MetaEditor; resolve all compiler errors and warnings.
3. Run Strategy Tester, then demo-only forward testing.
4. Confirm execution events and latency/slippage fields in the owner research-governance panel before any live use.

The bridge batches events on a timer because MT5 WebRequest is synchronous. Do not call it on every tick. The server accepts standalone telemetry batches with the authenticated account login; evidence remains pending review and never enables execution by itself.
