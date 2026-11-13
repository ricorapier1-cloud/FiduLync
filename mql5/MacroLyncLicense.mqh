//+------------------------------------------------------------------+
//|                                           MacroLyncLicense.mqh   |
//|                   Copyright 2026, Algolync Store & MacroLync     |
//|                         https://fidulync.vercel.app              |
//+------------------------------------------------------------------+
#property copyright "MacroLync & Algolync Store"
#property link      "https://fidulync.vercel.app"
#property version   "1.20"

input group "=== Algolync Store Licensing ==="
input string InpLicenseKey = "ALGOLYNX-PRO-98421"; // Your Algolync One-Time License Key

//+------------------------------------------------------------------+
//| VerifyAlgolyncLicense                                            |
//| Checks license key validity and account binding against backend  |
//+------------------------------------------------------------------+
bool VerifyAlgolyncLicense(string backendEndpoint = "https://fidulync.vercel.app/api/v1/validate-license")
{
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   uchar postData[];
   uchar result[];
   string resultHeaders;

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   string payload = StringFormat("{\"license_key\": \"%s\", \"mt5_account\": \"%I64d\", \"ea_name\": \"%s\"}", InpLicenseKey, accountNumber, MQLInfoString(MQL_PROGRAM_NAME));

   StringToCharArray(payload, postData, 0, StringLen(payload), CP_UTF8);

   ResetLastError();
   int res = WebRequest("POST", backendEndpoint, headers, 4000, postData, result, resultHeaders);
   
   if(res == 200)
   {
      string responseStr = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      if(StringFind(responseStr, "\"valid\":true") >= 0)
      {
         Print("[Algolync Licensing] One-time license VERIFIED for MT5 Account: ", accountNumber);
         return true;
      }
      else
      {
         Print("[Algolync Licensing REJECTED] Server response: ", responseStr);
         return false;
      }
   }

   int err = GetLastError();
   if(err == 4060)
   {
      Alert("[Algolync Licensing ERROR] WebRequest not permitted in MT5.\n\nAction Required:\n1. Go to Tools -> Options -> Expert Advisors\n2. Check 'Allow WebRequest for listed URL'\n3. Add: https://fidulync.vercel.app");
      Print("[Algolync Licensing ERROR 4060] URL not in MT5 allowlist: ", backendEndpoint);
   }
   else
   {
      Print("[Algolync Licensing] Validation failed. HTTP Status: ", res, " | MQL5 Error Code: ", err);
   }

   return false;
}
