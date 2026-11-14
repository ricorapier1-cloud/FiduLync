//+------------------------------------------------------------------+
//|                              MacroLync_Session_Momentum_Test.mq5 |
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

input group "=== SESSION & MOMENTUM PARAMETERS ==="
input double InpFixedLots       = 0.05;
input int    InpFastEma         = 21;
input int    InpSlowEma         = 55;
input int    InpRsiPeriod       = 14;
input int    InpStartHourUTC    = 7;
input int    InpEndHourUTC      = 17;
input int    InpStopLossPts     = 250;
input int    InpTakeProfitPts   = 500;
input ulong  InpMagic           = 202602;

int fastHandle, slowHandle, rsiHandle;
datetime lastBar = 0;

int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   fastHandle = iMA(_Symbol, PERIOD_CURRENT, InpFastEma, 0, MODE_EMA, PRICE_CLOSE);
   slowHandle = iMA(_Symbol, PERIOD_CURRENT, InpSlowEma, 0, MODE_EMA, PRICE_CLOSE);
   rsiHandle  = iRSI(_Symbol, PERIOD_CURRENT, InpRsiPeriod, PRICE_CLOSE);
   if(fastHandle == INVALID_HANDLE || slowHandle == INVALID_HANDLE || rsiHandle == INVALID_HANDLE) return INIT_FAILED;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   IndicatorRelease(fastHandle);
   IndicatorRelease(slowHandle);
   IndicatorRelease(rsiHandle);
}

void OnTick()
{
   datetime barTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(barTime == lastBar) return;
   lastBar = barTime;

   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   if(dt.hour < InpStartHourUTC || dt.hour >= InpEndHourUTC) return;
   if(PositionsTotal() > 0) return;

   double fast[2], slow[2], rsi[2];
   ArraySetAsSeries(fast, true); ArraySetAsSeries(slow, true); ArraySetAsSeries(rsi, true);
   if(CopyBuffer(fastHandle, 0, 1, 2, fast) < 2) return;
   if(CopyBuffer(slowHandle, 0, 1, 2, slow) < 2) return;
   if(CopyBuffer(rsiHandle, 0, 1, 2, rsi) < 2) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double pt  = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(fast[0] > slow[0] && rsi[0] > 55.0 && rsi[1] <= 55.0)
      trade.Buy(InpFixedLots, _Symbol, ask, NormalizeDouble(ask - InpStopLossPts * pt, _Digits), NormalizeDouble(ask + InpTakeProfitPts * pt, _Digits), "MacroLync Session Long");
   else if(fast[0] < slow[0] && rsi[0] < 45.0 && rsi[1] >= 45.0)
      trade.Sell(InpFixedLots, _Symbol, bid, NormalizeDouble(bid + InpStopLossPts * pt, _Digits), NormalizeDouble(bid - InpTakeProfitPts * pt, _Digits), "MacroLync Session Short");
}
