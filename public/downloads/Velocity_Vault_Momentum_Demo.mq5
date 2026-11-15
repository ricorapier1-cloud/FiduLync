//+------------------------------------------------------------------+
//|                                Velocity_Vault_Momentum_Demo.mq5  |
//|                        Copyright 2026, AlgoLync / AkinsootoFx    |
//|                                    https://fidulync.vercel.app   |
//|  License: MIT Open-Source Test Artifact (Free Testing EA)        |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AlgoLync / AkinsootoFx"
#property link      "https://fidulync.vercel.app"
#property version   "2.70"
#property description "Intraday Momentum Continuation MQL5 Demo Engine"
#property strict

#include <Trade\Trade.mqh>
CTrade trade;

input group "=== ALGOLYNX CLOUD LICENSE & TELEMETRY ==="
input string InpLicenseKey      = "ALGOLYNX-VELOCITY-DEMO";
input string InpServerOrigin    = "https://fidulync.vercel.app";
input bool   InpEnforceCloud    = false;

input group "=== VELOCITY VAULT MOMENTUM PARAMETERS ==="
input double InpRiskPercent     = 0.8;
input int    InpFastEma         = 9;
input int    InpSlowEma         = 21;
input double InpSlPoints        = 180.0;
input double InpTpPoints        = 420.0;
input ulong  InpMagicNumber     = 202627;

bool CheckCloudLicense()
{
   if(!InpEnforceCloud || InpLicenseKey == "ALGOLYNX-VELOCITY-DEMO") return true;
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
   Print("[Velocity Vault v2.7 Demo] Initialized successfully. Intraday momentum test mode active.");
   return INIT_SUCCEEDED;
}

void OnTick()
{
   if(!CheckCloudLicense()) return;
}
//+------------------------------------------------------------------+
