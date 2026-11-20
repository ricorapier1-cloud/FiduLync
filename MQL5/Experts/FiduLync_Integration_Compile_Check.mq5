#property strict
#property version   "1.00"
#property description "FiduLync compile-only integration fixture. Never trades or sends network requests."

#include <FiduLync/QuantSupervisor.mqh>
#include <FiduLync/ExecutionTelemetry.mqh>

CFiduLyncQuantSupervisor FiduLyncCompileSupervisor;
CFiduLyncExecutionTelemetry FiduLyncCompileTelemetry;

int OnInit()
{
   // Compile-only configuration. No endpoint is contacted and no broker action is possible.
   FiduLyncCompileSupervisor.Configure("https://compile.invalid", "compile-only", 1000);
   FiduLyncCompileTelemetry.Configure("https://compile.invalid", "compile-only", 1000);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {}
void OnTick() {}
void OnTimer() {}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   // Compile-checks the callback signature and both telemetry interfaces only.
   FiduLyncCompileTelemetry.CaptureTradeTransaction(trans, request, result);
}
