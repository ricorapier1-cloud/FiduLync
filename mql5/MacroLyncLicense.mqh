//+------------------------------------------------------------------+
//|                                         MacroLyncLicense.mqh     |
//|                   Copyright 2026, MacroLync & Algolync Store     |
//+------------------------------------------------------------------+
#property copyright "MacroLync & Algolync Store"
#property link      "https://fidulync.vercel.app"
#property version   "1.03"

// Read-only licence validation. No broker orders are submitted here.
bool VerifyAlgolyncLicense(string licenseKey, long mt5Account)
{
   if(StringLen(licenseKey) < 16 || mt5Account <= 0)
      return(false);

   string endpoint = "https://fidulync.vercel.app/api/v1/validate-license";
   string headers = "Content-Type: application/json\r\n";
   ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string accountType = (tradeMode == ACCOUNT_TRADE_MODE_REAL) ? "LIVE" : "DEMO";
   string postData = StringFormat(
      "{\"license_key\":\"%s\",\"account_number\":%I64d,\"account_type\":\"%s\"}",
      licenseKey, mt5Account, accountType
   );

   char post[], result[];
   string resultHeaders;
   StringToCharArray(postData, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(post) > 0)
      ArrayResize(post, ArraySize(post) - 1); // Exclude terminal NUL from JSON body.

   ResetLastError();
   int responseCode = WebRequest("POST", endpoint, headers, 5000, post, result, resultHeaders);
   if(responseCode != 200)
      return(false);

   string responseText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return(StringFind(responseText, "\"valid\":true") >= 0);
}
