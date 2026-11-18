//+------------------------------------------------------------------+
//| MacroLyncLicense.mqh                                             |
//| AlgoLync EA-scoped cloud license gate                            |
//| https://fidulync.vercel.app                                      |
//+------------------------------------------------------------------+
#ifndef MACRO_LYNC_LICENSE_MQH
#define MACRO_LYNC_LICENSE_MQH

#property version "2.00"

input group "=== AlgoLync Cloud Licensing ==="
input string InpLicenseKey = "";
input string InpAlgoLyncEaSlug = ""; // Must match the EA product slug in the Store
input string InpLicenseVerifyEndpoint = "https://fidulync.vercel.app/api/v1/license/verify";

string   g_AlgoLyncLeaseToken = "";
datetime g_AlgoLyncLeaseExpires = 0;

// Returns true only for an actual MT5 demo or real account. Contest mode is rejected.
string AlgoLyncAccountMode()
{
   ENUM_ACCOUNT_TRADE_MODE mode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(mode == ACCOUNT_TRADE_MODE_DEMO) return "DEMO";
   if(mode == ACCOUNT_TRADE_MODE_REAL) return "REAL";
   return "";
}

string AlgoLyncJsonString(const string source, const string key)
{
   string needle = "\"" + key + "\":\"";
   int start = StringFind(source, needle);
   if(start < 0) return "";
   start += StringLen(needle);
   int finish = StringFind(source, "\"", start);
   if(finish < 0) return "";
   return StringSubstr(source, start, finish - start);
}

long AlgoLyncJsonInteger(const string source, const string key)
{
   string needle = "\"" + key + "\":";
   int start = StringFind(source, needle);
   if(start < 0) return 0;
   start += StringLen(needle);
   while(start < StringLen(source) && StringGetCharacter(source, start) == ' ')
      start++;
   int finish = start;
   while(finish < StringLen(source))
   {
      ushort c = StringGetCharacter(source, finish);
      if((c < '0' || c > '9') && c != '-') break;
      finish++;
   }
   if(finish <= start) return 0;
   return StringToInteger(StringSubstr(source, start, finish - start));
}

bool AlgoLyncLeaseIsValid()
{
   return (g_AlgoLyncLeaseToken != "" && g_AlgoLyncLeaseExpires > TimeGMT());
}

string AlgoLyncGetLeaseToken()
{
   if(!AlgoLyncLeaseIsValid()) return "";
   return g_AlgoLyncLeaseToken;
}

// Call at EA initialization and refresh before the lease expires.
// A cached lease remains valid for up to 24 hours during temporary network outages.
bool VerifyAlgolyncLicense()
{
   string licenseKey = InpLicenseKey;
   string eaSlug = InpAlgoLyncEaSlug;
   StringTrimLeft(licenseKey); StringTrimRight(licenseKey);
   StringTrimLeft(eaSlug); StringTrimRight(eaSlug);

   if(licenseKey == "" || eaSlug == "")
   {
      Print("[AlgoLync] Enter both the license key and exact EA product slug.");
      return false;
   }

   string accountMode = AlgoLyncAccountMode();
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   if(accountMode == "" || login <= 0)
   {
      Print("[AlgoLync] Unsupported MT5 account mode or unavailable account login.");
      return false;
   }

   string payload = StringFormat(
      "{\"license_key\":\"%s\",\"ea_slug\":\"%s\",\"mt5_login\":\"%I64d\",\"account_mode\":\"%s\"}",
      licenseKey, eaSlug, login, accountMode
   );

   uchar encoded[];
   int encodedLength = StringToCharArray(payload, encoded, 0, WHOLE_ARRAY, CP_UTF8);
   if(encodedLength <= 1) return false;

   char requestData[];
   int payloadLength = encodedLength - 1;
   if(ArrayResize(requestData, payloadLength) != payloadLength) return false;
   for(int i = 0; i < payloadLength; i++) requestData[i] = (char)encoded[i];

   char responseData[];
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   ResetLastError();
   int httpStatus = WebRequest("POST", InpLicenseVerifyEndpoint, headers, 7000,
                               requestData, responseData, responseHeaders);
   int terminalError = GetLastError();

   if(httpStatus != 200)
   {
      if(terminalError == 4060)
         Alert("[AlgoLync] Add https://fidulync.vercel.app to MT5 Tools > Options > Expert Advisors > Allow WebRequest.");
      if(AlgoLyncLeaseIsValid())
      {
         PrintFormat("[AlgoLync] Verification unavailable (HTTP %d / MT5 %d). Existing 24-hour lease remains valid.",
                     httpStatus, terminalError);
         return true;
      }
      PrintFormat("[AlgoLync] Cloud verification failed. HTTP=%d, MT5 error=%d.", httpStatus, terminalError);
      return false;
   }

   int responseLength = ArraySize(responseData);
   if(responseLength <= 0) return false;
   uchar responseUtf8[];
   if(ArrayResize(responseUtf8, responseLength) != responseLength) return false;
   for(int j = 0; j < responseLength; j++) responseUtf8[j] = (uchar)responseData[j];
   string responseText = CharArrayToString(responseUtf8, 0, responseLength, CP_UTF8);
   StringTrimLeft(responseText); StringTrimRight(responseText);

   if(StringFind(responseText, "\"valid\":true") < 0)
   {
      // An explicit server denial overrides a previously cached lease.
      g_AlgoLyncLeaseToken = "";
      g_AlgoLyncLeaseExpires = 0;
      Print("[AlgoLync] License rejected: ", responseText);
      return false;
   }

   string lease = AlgoLyncJsonString(responseText, "lease_token");
   long expires = AlgoLyncJsonInteger(responseText, "lease_expires_unix");
   if(lease == "" || expires <= (long)TimeGMT())
   {
      Print("[AlgoLync] Server response did not contain a valid lease.");
      return false;
   }

   g_AlgoLyncLeaseToken = lease;
   g_AlgoLyncLeaseExpires = (datetime)expires;
   PrintFormat("[AlgoLync] EA-scoped license verified. Lease expires at %s UTC.",
               TimeToString(g_AlgoLyncLeaseExpires, TIME_DATE|TIME_MINUTES));
   return true;
}

// Licence expiry or a temporary API outage must never disable protective
// management of positions that are already open. EAs should continue exits,
// stop-loss updates, break-even, trailing and emergency risk controls.
bool AlgoLyncMayManageExistingPositions()
{
   return true;
}

// Only new exposure is gated by the current 24-hour cloud lease.
bool AlgoLyncMayOpenNewTrades()
{
   return AlgoLyncLeaseIsValid();
}

#endif // MACRO_LYNC_LICENSE_MQH
