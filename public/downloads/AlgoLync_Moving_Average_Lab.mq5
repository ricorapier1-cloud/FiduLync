//+------------------------------------------------------------------+
//| AlgoLync_Moving_Average_Lab.mq5                                  |
//| Copyright 2026, AkinsootoFx                                      |
//| https://fidulync.vercel.app                                      |
//| Original educational sandbox EA. Analysis only; no trade orders. |
//| MIT licence applies to this file; see TEST_EA_LICENSE.txt.       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AkinsootoFx"
#property link      "https://fidulync.vercel.app"
#property version   "1.00"
#property strict
#property description "Educational MT5 diagnostics: closed-bar moving-average crossover display. Does not place orders."

input group "=== MOVING AVERAGE RESEARCH ==="
input int InpFastPeriod = 20;
input int InpSlowPeriod = 50;
input ENUM_MA_METHOD InpMethod = MODE_EMA;
input ENUM_APPLIED_PRICE InpPrice = PRICE_CLOSE;

int g_fast_handle = INVALID_HANDLE;
int g_slow_handle = INVALID_HANDLE;
datetime g_last_bar = 0;

int OnInit()
{
   if(InpFastPeriod < 2 || InpSlowPeriod < 3 || InpFastPeriod >= InpSlowPeriod)
   {
      Print("AlgoLync MA Lab: fast period must be >= 2 and lower than slow period.");
      return INIT_PARAMETERS_INCORRECT;
   }
   g_fast_handle = iMA(_Symbol, PERIOD_CURRENT, InpFastPeriod, 0, InpMethod, InpPrice);
   g_slow_handle = iMA(_Symbol, PERIOD_CURRENT, InpSlowPeriod, 0, InpMethod, InpPrice);
   if(g_fast_handle == INVALID_HANDLE || g_slow_handle == INVALID_HANDLE)
   {
      Print("AlgoLync MA Lab: indicator initialization failed. Error=", GetLastError());
      return INIT_FAILED;
   }
   g_last_bar = 0;
   Comment("AlgoLync Moving Average Lab\nInitializing — analysis only; no orders are sent.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(g_fast_handle != INVALID_HANDLE) IndicatorRelease(g_fast_handle);
   if(g_slow_handle != INVALID_HANDLE) IndicatorRelease(g_slow_handle);
   Comment("");
}

void OnTick()
{
   datetime bar_time = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(bar_time <= 0 || bar_time == g_last_bar) return;
   g_last_bar = bar_time;

   double fast_values[];
   double slow_values[];
   ArraySetAsSeries(fast_values, true);
   ArraySetAsSeries(slow_values, true);
   if(CopyBuffer(g_fast_handle, 0, 1, 2, fast_values) != 2 ||
      CopyBuffer(g_slow_handle, 0, 1, 2, slow_values) != 2)
   {
      Print("AlgoLync MA Lab: waiting for sufficient indicator history.");
      return;
   }

   string state = "NEUTRAL / NO CROSS";
   if(fast_values[0] > slow_values[0] && fast_values[1] <= slow_values[1])
      state = "BULLISH CROSS ON CLOSED BAR";
   else if(fast_values[0] < slow_values[0] && fast_values[1] >= slow_values[1])
      state = "BEARISH CROSS ON CLOSED BAR";
   else if(fast_values[0] > slow_values[0])
      state = "FAST MA ABOVE SLOW MA";
   else if(fast_values[0] < slow_values[0])
      state = "FAST MA BELOW SLOW MA";

   Comment("AlgoLync Moving Average Lab",
           "\nSymbol: ", _Symbol,
           "\nTimeframe: ", EnumToString((ENUM_TIMEFRAMES)_Period),
           "\nFast MA: ", DoubleToString(fast_values[0], _Digits),
           "\nSlow MA: ", DoubleToString(slow_values[0], _Digits),
           "\nClosed-bar state: ", state,
           "\nMODE: ANALYSIS ONLY — NO ORDERS");
   Print("AlgoLync MA Lab | ", _Symbol, " | ", state);
}
