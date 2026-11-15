//+------------------------------------------------------------------+
//|                                           MacroLyncLicense.mqh   |
//|                   Copyright 2026, Algolync Store & MacroLync     |
//|                         https://fidulync.vercel.app              |
//+------------------------------------------------------------------+
#ifndef MACRO_LYNC_LICENSE_MQH
#define MACRO_LYNC_LICENSE_MQH

#property copyright "MacroLync & AlgoLync"
#property link      "https://fidulync.vercel.app"
#property version   "1.21"

input group "=== AlgoLync Store Licensing ==="
input string InpLicenseKey = ""; // Enter the license issued after verified purchase

//+------------------------------------------------------------------+
//| VerifyAlgoLyncLicense                                            |
//| Validates the license against the current MT5 trading account.   |
//+------------------------------------------------------------------+
bool VerifyAlgolyncLicense(string backendEndpoint = "https://fidulync.vercel.app/api/v1/validate-license")
{
   string licenseKey = InpLicenseKey;
   StringTrimLeft(licenseKey);
   StringTrimRight(licenseKey);
   if(licenseKey == "")
   {
      Print("[AlgoLync Licensing] Enter your purchased license key.");
      return false;
   }

   long accountNumber = AccountInfoInteger(ACCOUNT_LOGIN);
   if(accountNumber <= 0)
   {
      Print("[AlgoLync Licensing] MT5 account login is unavailable.");
      return false;
   }

   string payload = StringFormat(
      "{\"license_key\":\"%s\",\"mt5_account\":\"%I64d\"}",
      licenseKey,
      accountNumber
   );

   uchar utf8Data[];
   int encodedLength = StringToCharArray(payload, utf8Data, 0, WHOLE_ARRAY, CP_UTF8);
   if(encodedLength <= 1)
   {
      Print("[AlgoLync Licensing] Could not encode the verification request.");
      return false;
   }

   int payloadLength = encodedLength - 1;
   char requestData[];
   if(ArrayResize(requestData, payloadLength) != payloadLength)
   {
      Print("[AlgoLync Licensing] Could not allocate the verification request.");
      return false;
   }
   for(int i = 0; i < payloadLength; i++)
      requestData[i] = (char)utf8Data[i];

   char responseData[];
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";

   ResetLastError();
   int httpStatus = WebRequest("POST", backendEndpoint, headers, 5000, requestData, responseData, responseHeaders);
   int terminalError = GetLastError();

   if(httpStatus != 200)
   {
      if(terminalError == 4060)
      {
         Alert("[AlgoLync Licensing] Allow WebRequest for https://fidulync.vercel.app in MT5 Tools > Options > Expert Advisors.");
      }
      PrintFormat("[AlgoLync Licensing] Verification failed. HTTP=%d, MT5 error=%d.", httpStatus, terminalError);
      return false;
   }

   int responseLength = ArraySize(responseData);
   if(responseLength <= 0)
   {
      Print("[AlgoLync Licensing] Empty response from the license server.");
      return false;
   }

   uchar responseUtf8[];
   if(ArrayResize(responseUtf8, responseLength) != responseLength)
      return false;
   for(int j = 0; j < responseLength; j++)
      responseUtf8[j] = (uchar)responseData[j];

   string responseText = CharArrayToString(responseUtf8, 0, responseLength, CP_UTF8);
   StringTrimLeft(responseText);
   StringTrimRight(responseText);

   if(StringFind(responseText, "\"valid\":true") >= 0)
   {
      PrintFormat("[AlgoLync Licensing] License verified for MT5 account %I64d.", accountNumber);
      return true;
   }

   Print("[AlgoLync Licensing] License rejected: ", responseText);
   return false;
}

#endif // MACRO_LYNC_LICENSE_MQH
