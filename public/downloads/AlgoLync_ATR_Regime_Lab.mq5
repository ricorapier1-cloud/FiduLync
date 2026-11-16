//+------------------------------------------------------------------+
//| AlgoLync_ATR_Regime_Lab.mq5                                      |
//| Copyright 2026, AkinsootoFx                                      |
//| https://fidulync.vercel.app                                      |
//| Original educational sandbox EA. Analysis only; no trade orders. |
//| MIT licence applies to this file; see TEST_EA_LICENSE.txt.       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AkinsootoFx"
#property link      "https://fidulync.vercel.app"
#property version   "1.00"
#property strict
#property description "Educational MT5 diagnostics: ATR regime observation. Does not place orders."

input group "=== VOLATILITY OBSERVATION ==="
input int InpATRPeriod = 14;
input int InpBaselineBars = 30;
input double InpQuietThreshold = 0.75;
input double InpExpansionThreshold = 1.35;

int g_atr_handle = INVALID_HANDLE;
datetime g_last_bar = 0;

int OnInit()
{
   if(InpATRPeriod < 2 || InpBaselineBars < 5 ||
      InpQuietThreshold <= 0.0 || InpExpansionThreshold <= InpQuietThreshold)
   {
      Print("AlgoLync ATR Lab: invalid parameters.");
      return INIT_PARAMETERS_INCORRECT;
   }
   g_atr_handle = iATR(_Symbol, PERIOD_CURRENT, InpATRPeriod);
   if(g_atr_handle == INVALID_HANDLE)
   {
      Print("AlgoLync ATR Lab: indicator initialization failed. Error=", GetLastError());
      return INIT_FAILED;
   }
   g_last_bar = 0;
   Comment("AlgoLync ATR Regime Lab\nInitializing — analysis only; no orders are sent.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(g_atr_handle != INVALID_HANDLE) IndicatorRelease(g_atr_handle);
   Comment("");
}

void OnTick()
{
   datetime bar_time = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(bar_time <= 0 || bar_time == g_last_bar) return;
   g_last_bar = bar_time;

   double atr_values[];
   ArraySetAsSeries(atr_values, true);
   int required = InpBaselineBars + 1;
   if(CopyBuffer(g_atr_handle, 0, 1, required, atr_values) != required)
   {
      Print("AlgoLync ATR Lab: waiting for sufficient indicator history.");
      return;
   }

   double baseline = 0.0;
   for(int i = 1; i < required; i++) baseline += atr_values[i];
   baseline /= (double)InpBaselineBars;
   if(baseline <= 0.0)
   {
      Print("AlgoLync ATR Lab: baseline is not yet usable.");
      return;
   }

   double ratio = atr_values[0] / baseline;
   string regime = "TYPICAL VOLATILITY";
   if(ratio < InpQuietThreshold) regime = "QUIETER THAN BASELINE";
   else if(ratio > InpExpansionThreshold) regime = "VOLATILITY EXPANSION";

   Comment("AlgoLync ATR Regime Lab",
           "\nSymbol: ", _Symbol,
           "\nTimeframe: ", EnumToString((ENUM_TIMEFRAMES)_Period),
           "\nATR: ", DoubleToString(atr_values[0], _Digits),
           "\nBaseline ATR: ", DoubleToString(baseline, _Digits),
           "\nATR / Baseline: ", DoubleToString(ratio, 2), "x",
           "\nRegime: ", regime,
           "\nMODE: ANALYSIS ONLY — NO ORDERS");
   Print("AlgoLync ATR Lab | ", _Symbol, " | ", regime, " | ratio=", DoubleToString(ratio, 2));
}
