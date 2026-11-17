//+------------------------------------------------------------------+
//|                                             MacroLyncLicense.mqh |
//|                         FiduLync / AlgoLync Cloud Licensing Gate |
//|                             https://fidulync.vercel.app          |
//+------------------------------------------------------------------+
#property copyright "AlgoLync Institutional Systems"
#property link      "https://fidulync.vercel.app"
#property strict

//+------------------------------------------------------------------+
//| License Validation Result Structure                              |
//+------------------------------------------------------------------+
struct MacroLyncLicenseResult
{
   bool   isValid;
   string tier;
   string message;
   string expiresAt;
   int    maxLiveSlots;
   int    maxDemoSlots;
};

//+------------------------------------------------------------------+
//| Verify EA License against AlgoLync Cloud Gate via WebRequest     |
//| Important: Add https://fidulync.vercel.app to allowed URLs in    |
//| MT5 -> Tools -> Options -> Expert Advisors -> Allow WebRequest   |
//+------------------------------------------------------------------+
bool MacroLync_VerifyLicense(
   const string licenseKey,
   const string eaSlug = "eridam-nexus-pro",
   const string serverUrl = "https://fidulync.vercel.app",
   const int timeoutMs = 8000
)
{
   // Check if running in offline Strategy Tester
   if(MQLInfoInteger(MQL_TESTER) || MQLInfoInteger(MQL_OPTIMIZATION))
   {
      Print("[AlgoLync License Gate] Strategy Tester mode active. Bypassing cloud WebRequest for offline backtest.");
      return true;
   }

   string endpoint = serverUrl + "/api/v1/validate-license";
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   
   long accountLogin = AccountInfoInteger(ACCOUNT_LOGIN);
   string accountServer = AccountInfoString(ACCOUNT_SERVER);
   ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string tradeModeStr = (tradeMode == ACCOUNT_TRADE_MODE_DEMO) ? "DEMO" : (tradeMode == ACCOUNT_TRADE_MODE_REAL ? "REAL" : "CONTEST");

   string postPayload = StringFormat(
      "{\"license_key\":\"%s\",\"mt5_account\":%I64d,\"server\":\"%s\",\"trade_mode\":\"%s\",\"ea_slug\":\"%s\"}",
      licenseKey, accountLogin, accountServer, tradeModeStr, eaSlug
   );

   char postData[];
   StringToCharArray(postPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int postDataLen = ArraySize(postData) - 1; // omit null terminator

   char resultData[];
   string resultHeaders;
   ResetLastError();

   int res = WebRequest("POST", endpoint, headers, timeoutMs, postData, resultData, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      PrintFormat("[AlgoLync License Gate ERROR] WebRequest failed (error %d).", err);
      if(err == 4060)
      {
         Print("[AlgoLync License Gate] Please add 'https://fidulync.vercel.app' in MT5 -> Tools -> Options -> Expert Advisors -> WebRequest.");
      }
      return false;
   }

   string jsonResponse = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);

   // Simple parse for valid flag
   if(res == 200 && StringFind(jsonResponse, "\"valid\":true") >= 0)
   {
      PrintFormat("[AlgoLync License Gate] License verified successfully for Account %I64d (%s mode).", accountLogin, tradeModeStr);
      return true;
   }
   else
   {
      PrintFormat("[AlgoLync License Gate] License DENIED for Account %I64d. Server response: %s", accountLogin, jsonResponse);
      return false;
   }
}
