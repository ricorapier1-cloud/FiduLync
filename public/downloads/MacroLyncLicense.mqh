//+------------------------------------------------------------------+
//|                                         MacroLyncLicense.mqh     |
//|                   Copyright 2026, MacroLync & AlgoLync Store     |
//+------------------------------------------------------------------+
#property copyright "MacroLync & AlgoLync Store"
#property link      "https://fidulync.vercel.app"
#property version   "1.04"

// Server-authoritative, read-only licence validation.
// The API returns a signed HS256 24-hour lease. Keep this token server-side
// when posting telemetry; do not treat a client-parsed JSON flag as a local
// cryptographic signature check. The server remains the entitlement authority.

string ML_JsonStringValue(const string json, const string key)
{
   string needle = "\"" + key + "\"";
   int keyPos = StringFind(json, needle);
   if(keyPos < 0) return("");
   int colon = StringFind(json, ":", keyPos + StringLen(needle));
   if(colon < 0) return("");
   int start = colon + 1;
   while(start < StringLen(json) && StringGetCharacter(json, start) <= 32) start++;
   if(start >= StringLen(json) || StringGetCharacter(json, start) != '"') return("");
   start++;
   int end = start;
   bool escaped = false;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if(ch == '"' && !escaped) break;
      if(ch == '\\' && !escaped) escaped = true;
      else escaped = false;
      end++;
   }
   if(end >= StringLen(json)) return("");
   return(StringSubstr(json, start, end - start));
}

bool ML_PostLicenseRequest(const string endpoint, const string postData, string &responseText)
{
   string headers = "Content-Type: application/json\r\n";
   char post[], result[];
   string responseHeaders;
   int copied = StringToCharArray(postData, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied <= 1) return(false);
   ArrayResize(post, copied - 1); // Exclude terminal NUL from the JSON body.
   ResetLastError();
   int status = WebRequest("POST", endpoint, headers, 8000, post, result, responseHeaders);
   if(status != 200) return(false);
   responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return(StringFind(responseText, "\"valid\":true") >= 0);
}

// Canonical contract: license_key + mt5_login + account_mode + ea_slug.
// Captures the signed lease token and its UTC expiry for subsequent heartbeat use.
bool GetAlgolyncLicenseLease(string licenseKey, long mt5Account, string eaSlug,
                             string &leaseToken, string &leaseExpiresAt)
{
   leaseToken = "";
   leaseExpiresAt = "";
   if(StringLen(licenseKey) < 16 || mt5Account <= 0 ||
      StringLen(eaSlug) < 3 || StringFind(eaSlug, "/") >= 0 ||
      StringFind(eaSlug, "\\") >= 0 || StringFind(eaSlug, "\"") >= 0)
      return(false);

   ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string accountMode = (tradeMode == ACCOUNT_TRADE_MODE_REAL) ? "LIVE" : "DEMO";
   string body = StringFormat(
      "{\"license_key\":\"%s\",\"mt5_login\":%I64d,\"account_mode\":\"%s\",\"ea_slug\":\"%s\",\"broker_server\":\"%s\"}",
      licenseKey, mt5Account, accountMode, eaSlug, AccountInfoString(ACCOUNT_SERVER)
   );
   string response = "";
   if(!ML_PostLicenseRequest("https://fidulync.vercel.app/api/v1/license/verify", body, response))
      return(false);

   leaseToken = ML_JsonStringValue(response, "lease_token");
   leaseExpiresAt = ML_JsonStringValue(response, "lease_expires_at");
   if(StringLen(leaseToken) < 40 || StringLen(leaseExpiresAt) < 20)
   {
      leaseToken = "";
      leaseExpiresAt = "";
      return(false);
   }
   return(true);
}


bool SendAlgolyncLicenseHeartbeat(string leaseToken, string eaSlug, long mt5Account,
                                  double balance, double equity, double drawdownPct,
                                  double floatingPnl, int openPositions, int pingMs)
{
   if(StringLen(leaseToken) < 40 || StringLen(eaSlug) < 3 || mt5Account <= 0 ||
      balance < -1000000000000.0 || balance > 1000000000000.0 ||
      equity < -1000000000000.0 || equity > 1000000000000.0 ||
      drawdownPct < 0.0 || drawdownPct > 1000.0 ||
      floatingPnl < -1000000000000.0 || floatingPnl > 1000000000000.0 ||
      openPositions < 0 || openPositions > 5000 || pingMs < 0 || pingMs > 120000)
      return(false);

   string body = StringFormat(
      "{\"balance\":%s,\"equity\":%s,\"drawdown_pct\":%s,\"floating_pnl\":%s,\"open_positions\":%d,\"vps_ping_ms\":%d,\"ea_name\":\"%s\"}",
      DoubleToString(balance, 2), DoubleToString(equity, 2),
      DoubleToString(drawdownPct, 4), DoubleToString(floatingPnl, 2),
      openPositions, pingMs, eaSlug
   );
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + leaseToken + "\\r\\n";
   char post[], result[];
   string responseHeaders;
   int copied = StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied <= 1) return(false);
   ArrayResize(post, copied - 1);
   ResetLastError();
   int status = WebRequest("POST", "https://fidulync.vercel.app/api/v1/license/heartbeat",
                           headers, 8000, post, result, responseHeaders);
   if(status != 200) return(false);
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return(StringFind(response, "\"accepted\":true") >= 0);
}

// Preferred overload for EAs that know their immutable product slug.
bool VerifyAlgolyncLicense(string licenseKey, long mt5Account, string eaSlug)
{
   string leaseToken, leaseExpiresAt;
   return(GetAlgolyncLicenseLease(licenseKey, mt5Account, eaSlug, leaseToken, leaseExpiresAt));
}

// Backward-compatible overload. Product identity is inferred from the licence
// record server-side; new product integrations should use the three-argument overload.
bool VerifyAlgolyncLicense(string licenseKey, long mt5Account)
{
   if(StringLen(licenseKey) < 16 || mt5Account <= 0) return(false);
   ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string accountType = (tradeMode == ACCOUNT_TRADE_MODE_REAL) ? "LIVE" : "DEMO";
   string body = StringFormat(
      "{\"license_key\":\"%s\",\"account_number\":%I64d,\"account_type\":\"%s\"}",
      licenseKey, mt5Account, accountType
   );
   string response = "";
   return(ML_PostLicenseRequest("https://fidulync.vercel.app/api/v1/validate-license", body, response));
}
