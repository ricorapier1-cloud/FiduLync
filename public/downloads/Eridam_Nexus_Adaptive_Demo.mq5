//+------------------------------------------------------------------+
//|                                  Eridam_Nexus_Adaptive_Demo.mq5  |
//|                        Copyright 2026, AlgoLync / AkinsootoFx    |
//|                                    https://fidulync.vercel.app   |
//|  License: MIT Open-Source Test Artifact (Free Testing EA)        |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AlgoLync / AkinsootoFx"
#property link      "https://fidulync.vercel.app"
#property version   "4.20"
#property description "Flagship Institutional Regime-Adaptive MQL5 Demo Engine"
#property strict

#include <Trade\Trade.mqh>
CTrade trade;

input group "=== ALGOLYNX CLOUD LICENSE & TELEMETRY ==="
input string InpLicenseKey      = "ALGOLYNX-NEXUS-DEMO";
input string InpServerOrigin    = "https://fidulync.vercel.app";
input bool   InpEnforceCloud    = false;

input group "=== ERIDAM NEXUS REGIME ENGINE ==="
input double InpRiskPercent     = 1.0;
input int    InpAtrPeriod       = 14;
input double InpVolatilityFilter= 1.25;
input double InpSlAtrMult       = 1.5;
input double InpTpAtrMult       = 3.2;
input ulong  InpMagicNumber     = 202642;

int atrHandle = INVALID_HANDLE;
datetime lastBarTime = 0;

bool CheckCloudLicense()
{
   if(!InpEnforceCloud || InpLicenseKey == "ALGOLYNX-NEXUS-DEMO") return true;
   string url = InpServerOrigin + "/api/v1/validate-license";
   string headers = "Content-Type: application/json\r\n";
   char post[], result[];
   string resHeaders;
   string payload = StringFormat("{\"license_key\":\"%s\",\"mt5_account\":%I64d}", InpLicenseKey, AccountInfoInteger(ACCOUNT_LOGIN));
   StringToCharArray(payload, post, 0, StringLen(payload), CP_UTF8);
   int code = WebRequest("POST", url, headers, 4000, post, result, resHeaders);
   if(code != 200) return false;
   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return (StringFind(body, "\"valid\":true") != -1);
}

int OnInit()
{
   trade.SetExpertMagicNumber(InpMagicNumber);
   atrHandle = iATR(_Symbol, _Period, InpAtrPeriod);
   if(atrHandle == INVALID_HANDLE)
   {
      Print("[Eridam Nexus] Failed to create ATR handle.");
      return INIT_FAILED;
   }
   Print("[Eridam Nexus Pro v4.2 Demo] Initialized successfully. Sandbox demo mode active.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(atrHandle != INVALID_HANDLE) IndicatorRelease(atrHandle);
}

void OnTick()
{
   datetime currentBar = iTime(_Symbol, _Period, 0);
   if(currentBar == lastBarTime) return;
   lastBarTime = currentBar;

   if(!CheckCloudLicense())
   {
      Print("[Eridam Nexus] Cloud license invalid or inactive. Please provision license on https://fidulync.vercel.app/store");
      return;
   }

   double atr[];
   ArraySetAsSeries(atr, true);
   if(CopyBuffer(atrHandle, 0, 0, 3, atr) < 3) return;

   // Execution sandbox demo simulation check
   PrintFormat("[Eridam Nexus] Heartbeat tick on %s, ATR: %.5f, Account: %I64d", _Symbol, atr[0], AccountInfoInteger(ACCOUNT_LOGIN));
}
//+------------------------------------------------------------------+
