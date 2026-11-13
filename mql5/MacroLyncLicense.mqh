//+------------------------------------------------------------------+
//|                                           MacroLyncLicense.mqh   |
//|                   Copyright 2026, Algolync Store & MacroLync     |
//|                         https://your-app.vercel.app              |
//+------------------------------------------------------------------+
#property copyright "MacroLync & Algolync Store"
#property link      "https://your-app.vercel.app"
#property version   "1.00"

input group "=== Algolync Store Licensing ==="
input string InpLicenseKey = "ALGOLYNX-DEMO-KEY"; // Your Algolync License Key

bool VerifyAlgolyncLicense(string backendEndpoint)
{
   string headers = "Content-Type: application/json\r\n";
   uchar postData[];
   uchar result[];
   string resultHeaders;

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   string payload = StringFormat("{\"license_key\": \"%s\", \"mt5_account\": \"%I64d\"}", InpLicenseKey, accountNumber);

   StringToCharArray(payload, postData, 0, StringLen(payload), CP_UTF8);

   int res = WebRequest("POST", backendEndpoint, headers, 3000, postData, result, resultHeaders);
   
   if(res == 200)
   {
      string responseStr = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      if(StringFind(responseStr, "\"valid\":true") >= 0)
      {
         Print("[Algolync Licensing] License successfully verified for Account: ", accountNumber);
         return true;
      }
   }

   Print("[Algolync Licensing] License validation FAILED or WebRequest refused. HTTP Code: ", res);
   return false;
}
