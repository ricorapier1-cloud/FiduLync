//+------------------------------------------------------------------+
//|                                           MacroLyncBridge.mqh    |
//|                   Copyright 2026, MacroLync & Algolync Store     |
//|                         https://fidulync.vercel.app              |
//+------------------------------------------------------------------+
#property copyright "MacroLync & Algolync Store"
#property link      "https://fidulync.vercel.app"
#property version   "1.01"

input group "=== MacroLync Institutional Telemetry ==="
input string InpMacroEndpoint = "https://fidulync.vercel.app/api/v1/macro-signal";
input bool   InpEnableRolloverShield = true; // 20:45 - 22:15 UTC Shield

bool CheckRolloverWindow()
{
   if(!InpEnableRolloverShield) return false;
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   int totalMinutes = dt.hour * 60 + dt.min;
   // 20:45 (1245 min) to 22:15 (1335 min) UTC
   if(totalMinutes >= 1245 && totalMinutes <= 1335) return true;
   return false;
}
