//+------------------------------------------------------------------+
//|                                         MacroLyncLicense.mqh     |
//|                   Copyright 2026, MacroLync & Algolync Store     |
//+------------------------------------------------------------------+
#property copyright "MacroLync & Algolync Store"
#property link      "https://fidulync.vercel.app"

bool VerifyAlgolyncLicense(string licenseKey, long mt5Account)
{
   string endpoint = "https://fidulync.vercel.app/api/v1/validate-license";
   string headers = "Content-Type: application/json\r\n";
   string postData = StringFormat("{\"license_key\":\"%s\", \"mt5_account\":%d}", licenseKey, mt5Account);
   char   post[], result[];
   string resultHeaders;
   
   StringToCharArray(postData, post, 0, WHOLE_ARRAY, CP_UTF8);
   
   ResetLastError();
   int res = WebRequest("POST", endpoint, headers, 5000, post, result, resultHeaders);
   
   if(res == 200)
   {
      string responseStr = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      if(StringFind(responseStr, "\"valid\":true") >= 0)
         return(true);
   }
   return(false);
}
