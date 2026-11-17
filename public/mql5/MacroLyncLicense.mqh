//+------------------------------------------------------------------+
//| MacroLyncLicense.mqh                                             |
//| Server-authoritative AlgoLync license verification and lease     |
//+------------------------------------------------------------------+
#ifndef MACRO_LYNC_LICENSE_MQH
#define MACRO_LYNC_LICENSE_MQH
#property copyright "MacroLync & AlgoLync"
#property link      "https://fidulync.vercel.app"
#property version   "2.00"
input group "=== AlgoLync Cloud Licensing ==="
input string InpLicenseKey = "";
input string InpAlgoLyncEaSlug = "";
input string InpLicenseEndpoint = "https://fidulync.vercel.app/api/v1/license/verify";
input int InpLicenseTimeoutMs = 7000;
string g_AlgoLyncLeaseToken = "";
datetime g_AlgoLyncLeaseExpiry = 0;
long g_AlgoLyncLeaseLogin = 0;
string g_AlgoLyncLeaseKey = "";
string g_AlgoLyncLeaseSlug = "";

string AlgoLyncJsonString(const string source,const string key)
{
   string marker = "\"" + key + "\":\"";
   int start = StringFind(source,marker);
   if(start < 0) return "";
   start += StringLen(marker);
   int finish = StringFind(source,"\"",start);
   if(finish < 0) return "";
   return StringSubstr(source,start,finish-start);
}
long AlgoLyncJsonInteger(const string source,const string key)
{
   string marker = "\"" + key + "\":";
   int start = StringFind(source,marker);
   if(start < 0) return 0;
   start += StringLen(marker);
   while(start < StringLen(source) && StringGetCharacter(source,start) == 32) start++;
   int finish = start;
   while(finish < StringLen(source))
   {
      ushort ch = StringGetCharacter(source,finish);
      if(ch < 48 || ch > 57) break;
      finish++;
   }
   if(finish <= start) return 0;
   return (long)StringToInteger(StringSubstr(source,start,finish-start));
}
bool AlgoLyncCurrentAccountIsDemo()
{
   return (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_DEMO;
}
bool VerifyAlgolyncLicense()
{
   string licenseKey = InpLicenseKey;
   string eaSlug = InpAlgoLyncEaSlug;
   StringTrimLeft(licenseKey); StringTrimRight(licenseKey);
   StringTrimLeft(eaSlug); StringTrimRight(eaSlug);
   StringToLower(eaSlug);
   if(licenseKey == "" || eaSlug == "")
   {
      Print("[AlgoLync] License key and exact EA product slug are required.");
      return false;
   }
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   if(login <= 0) return false;
   string mode = AlgoLyncCurrentAccountIsDemo() ? "DEMO" : "REAL";
   if(g_AlgoLyncLeaseToken != "" && g_AlgoLyncLeaseKey == licenseKey
      && g_AlgoLyncLeaseSlug == eaSlug && g_AlgoLyncLeaseLogin == login
      && TimeCurrent() < g_AlgoLyncLeaseExpiry - 300)
      return true;

   string payload = StringFormat("{\"license_key\":\"%s\",\"mt5_login\":%I64d,\"account_mode\":\"%s\",\"ea_slug\":\"%s\"}",licenseKey,login,mode,eaSlug);
   uchar encoded[];
   int encodedCount = StringToCharArray(payload,encoded,0,WHOLE_ARRAY,CP_UTF8);
   if(encodedCount <= 1) return false;
   int dataCount = encodedCount - 1;
   char requestData[];
   if(ArrayResize(requestData,dataCount) != dataCount) return false;
   for(int i=0;i<dataCount;i++) requestData[i]=(char)encoded[i];
   char responseData[];
   string responseHeaders;
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   ResetLastError();
   int status = WebRequest("POST",InpLicenseEndpoint,headers,InpLicenseTimeoutMs,requestData,responseData,responseHeaders);
   int terminalError = GetLastError();
   if(status != 200)
   {
      if(terminalError == 4060)
         Alert("[AlgoLync] Add https://fidulync.vercel.app to MT5 Tools > Options > Expert Advisors > Allow WebRequest.");
      PrintFormat("[AlgoLync] License authority unavailable. HTTP=%d, terminal error=%d.",status,terminalError);
      return false;
   }
   int responseCount = ArraySize(responseData);
   if(responseCount <= 0) return false;
   uchar responseUtf8[];
   if(ArrayResize(responseUtf8,responseCount) != responseCount) return false;
   for(int j=0;j<responseCount;j++) responseUtf8[j]=(uchar)responseData[j];
   string response = CharArrayToString(responseUtf8,0,responseCount,CP_UTF8);
   if(StringFind(response,"\"valid\":true") < 0)
   {
      Print("[AlgoLync] License rejected: ",response);
      g_AlgoLyncLeaseToken = "";
      g_AlgoLyncLeaseExpiry = 0;
      return false;
   }
   string token = AlgoLyncJsonString(response,"lease_token");
   long expiry = AlgoLyncJsonInteger(response,"lease_expires_unix");
   if(token == "" || expiry <= (long)TimeCurrent())
   {
      Print("[AlgoLync] License response did not contain a valid signed lease.");
      return false;
   }
   g_AlgoLyncLeaseToken = token;
   g_AlgoLyncLeaseExpiry = (datetime)expiry;
   g_AlgoLyncLeaseLogin = login;
   g_AlgoLyncLeaseKey = licenseKey;
   g_AlgoLyncLeaseSlug = eaSlug;
   PrintFormat("[AlgoLync] %s license verified for EA %s / MT5 %I64d. Lease valid until %s.",mode,eaSlug,login,TimeToString(g_AlgoLyncLeaseExpiry,TIME_DATE|TIME_MINUTES));
   return true;
}
string AlgoLyncGetLeaseToken()
{
   if(g_AlgoLyncLeaseToken == "" || TimeCurrent() >= g_AlgoLyncLeaseExpiry) return "";
   return g_AlgoLyncLeaseToken;
}
#endif
