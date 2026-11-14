//+------------------------------------------------------------------+
//|                                  MacroLync_G10_Breakout_Test.mq5 |
//|                        Copyright 2026, AlgoLync / AkinsootoFx    |
//|                                    https://fidulync.vercel.app   |
//|  License: MIT Open-Source Test Artifact (Free for Testing)       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AlgoLync / AkinsootoFx"
#property link      "https://fidulync.vercel.app"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>
CTrade trade;

input group "=== ALGOLYNX CLOUD LICENSE & TELEMETRY ==="
input string InpLicenseKey      = "ALGOLYNX-FREE-TEST"; 
input string InpServerOrigin    = "https://fidulync.vercel.app";
input bool   InpEnforceCloud    = false;

input group "=== G10 ATR BREAKOUT PARAMETERS ==="
input double InpRiskPercent     = 1.0;
input int    InpAtrPeriod       = 14;
input int    InpLookbackBars    = 20;
input double InpSlAtrMult       = 1.8;
input double InpTpAtrMult       = 3.0;
input ulong  InpMagicNumber     = 202601;

int atrHandle = INVALID_HANDLE;
datetime lastBarTime = 0;

bool CheckCloudLicense()
{
   if(!InpEnforceCloud || InpLicenseKey == "ALGOLYNX-FREE-TEST") return true;
   string url = InpServerOrigin + "/api/v1/validate-license";
   string headers = "Content-Type: application/json\r\n";
   char post[], result[];
   string resHeaders;
   string payload = StringFormat("{\"license_key\":\"%s\",\"mt5_account\":%I64d}", InpLicenseKey, AccountInfoInteger(ACCOUNT_LOGIN));
   StringToCharArray(payload, post, 0, StringLen(payload), CP_UTF8);
   int code = WebRequest("POST", url, headers, 4000, post, result, resHeaders);
   if(code != 200) { Print("MacroLync Cloud Gate: Whitelist ", InpServerOrigin, " in MT5 Options."); return false; }
   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return (StringFind(body, "\"valid\":true") != -1);
}

int OnInit()
{
   if(!CheckCloudLicense()) return INIT_FAILED;
   trade.SetExpertMagicNumber(InpMagicNumber);
   atrHandle = iATR(_Symbol, PERIOD_CURRENT, InpAtrPeriod);
   if(atrHandle == INVALID_HANDLE) return INIT_FAILED;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(atrHandle != INVALID_HANDLE) IndicatorRelease(atrHandle);
}

void OnTick()
{
   datetime currentBar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(currentBar == lastBarTime) return;
   lastBarTime = currentBar;
   if(PositionsTotal() > 0) return;

   double atr[];
   ArraySetAsSeries(atr, true);
   if(CopyBuffer(atrHandle, 0, 1, 1, atr) < 1) return;

   double highestHigh = iHigh(_Symbol, PERIOD_CURRENT, iHighest(_Symbol, PERIOD_CURRENT, MODE_HIGH, InpLookbackBars, 2));
   double lowestLow   = iLow(_Symbol, PERIOD_CURRENT, iLowest(_Symbol, PERIOD_CURRENT, MODE_LOW, InpLookbackBars, 2));
   double prevClose   = iClose(_Symbol, PERIOD_CURRENT, 1);

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double slDist = atr[0] * InpSlAtrMult;
   double tpDist = atr[0] * InpTpAtrMult;

   if(prevClose > highestHigh)
      trade.Buy(0.01, _Symbol, ask, NormalizeDouble(ask - slDist, _Digits), NormalizeDouble(ask + tpDist, _Digits), "MacroLync Breakout Long");
   else if(prevClose < lowestLow)
      trade.Sell(0.01, _Symbol, bid, NormalizeDouble(bid + slDist, _Digits), NormalizeDouble(bid - tpDist, _Digits), "MacroLync Breakout Short");
}
