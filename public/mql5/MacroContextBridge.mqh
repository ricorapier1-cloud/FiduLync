#ifndef FIDULYNC_MACRO_CONTEXT_BRIDGE_MQH
#define FIDULYNC_MACRO_CONTEXT_BRIDGE_MQH
#property strict

// Read-only fundamental context client. This include never submits or manages orders.
struct FiduLyncMacroContext
{
   string symbol;
   string data_status;
   string fundamental_bias;
   string macro_regime;
   double fundamental_score;
   bool score_available;
   double policy_rate_differential_bps;
   bool policy_differential_available;
   double real_rate_proxy_differential_bps;
   bool real_rate_proxy_available;
   bool high_impact_lockout;
   string generated_at_utc;
};

string FMC_JsonScalar(const string json, const string key)
{
   string needle = "\"" + key + "\"";
   int key_position = StringFind(json, needle);
   if(key_position < 0) return "";
   int colon = StringFind(json, ":", key_position + StringLen(needle));
   if(colon < 0) return "";
   int start = colon + 1;
   while(start < StringLen(json) && StringGetCharacter(json, start) <= 32) start++;
   int end = start;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch <= 32) break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

string FMC_JsonString(const string json, const string key)
{
   string needle = "\"" + key + "\"";
   int key_position = StringFind(json, needle);
   if(key_position < 0) return "";
   int colon = StringFind(json, ":", key_position + StringLen(needle));
   if(colon < 0) return "";
   int start = colon + 1;
   while(start < StringLen(json) && StringGetCharacter(json, start) <= 32) start++;
   if(start >= StringLen(json) || StringGetCharacter(json, start) != '"') return "";
   start++;
   int end = start;
   while(end < StringLen(json) && StringGetCharacter(json, end) != '"') end++;
   if(end >= StringLen(json)) return "";
   return StringSubstr(json, start, end - start);
}

bool FMC_Number(const string value)
{
   if(value == "" || value == "null") return false;
   return StringToDouble(value) == StringToDouble(value);
}

string FMC_UtcTimestamp()
{
   MqlDateTime utc;
   TimeToStruct(TimeGMT(), utc);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      utc.year, utc.mon, utc.day, utc.hour, utc.min, utc.sec);
}

string FMC_BaseUrl(string value)
{
   StringTrimLeft(value);
   StringTrimRight(value);
   while(StringLen(value) > 0 && StringSubstr(value, StringLen(value) - 1, 1) == "/")
      value = StringSubstr(value, 0, StringLen(value) - 1);
   return value;
}

bool FiduLyncGetMacroContext(
   const string symbol,
   const string base_url,
   const string installation_token,
   FiduLyncMacroContext &context,
   const int timeout_ms = 5000
)
{
   context.symbol = symbol;
   context.data_status = "UNAVAILABLE";
   context.fundamental_bias = "INSUFFICIENT_EVIDENCE";
   context.macro_regime = "INSUFFICIENT_EVIDENCE";
   context.fundamental_score = 0.0;
   context.score_available = false;
   context.policy_rate_differential_bps = 0.0;
   context.policy_differential_available = false;
   context.real_rate_proxy_differential_bps = 0.0;
   context.real_rate_proxy_available = false;
   context.high_impact_lockout = true;
   context.generated_at_utc = "";

   string root = FMC_BaseUrl(base_url);
   if(root == "" || installation_token == "" || StringLen(symbol) != 6)
      return false;

   string url = root + "/api/v1/macro-context?symbol=" + symbol;
   string headers = "Authorization: Bearer " + installation_token
      + "\r\nX-MT5-Timestamp: " + FMC_UtcTimestamp()
      + "\r\nAccept: application/json\r\n";
   char request_data[];
   char response_data[];
   string response_headers;
   ArrayResize(request_data, 0);

   ResetLastError();
   int status = WebRequest("GET", url, headers, timeout_ms, request_data, response_data, response_headers);
   int error_code = GetLastError();
   if(status != 200)
   {
      PrintFormat("FiduLync macro context returned HTTP %d (GetLastError=%d).", status, error_code);
      return false;
   }

   string payload = CharArrayToString(response_data, 0, WHOLE_ARRAY, CP_UTF8);
   StringTrimLeft(payload);
   StringTrimRight(payload);
   if(payload == "" || FMC_JsonString(payload, "symbol") != symbol)
      return false;

   string data_status = FMC_JsonString(payload, "data_status");
   string bias = FMC_JsonString(payload, "fundamental_bias");
   string regime = FMC_JsonString(payload, "macro_regime");
   string score = FMC_JsonScalar(payload, "fundamental_score");
   string policy = FMC_JsonScalar(payload, "policy_rate_differential_bps");
   string real_rate = FMC_JsonScalar(payload, "policy_real_rate_proxy_differential_bps");
   string lockout = FMC_JsonScalar(payload, "high_impact_lockout");
   string calendar = FMC_JsonString(payload, "calendar_status");
   string generated = FMC_JsonString(payload, "generated_at_utc");

   if((data_status != "PROVIDER" && data_status != "PARTIAL")
      || (bias != "BULLISH_BASE" && bias != "BEARISH_BASE" && bias != "NEUTRAL"
         && bias != "INSUFFICIENT_EVIDENCE")
      || regime == "" || generated == "")
      return false;

   context.data_status = data_status;
   context.fundamental_bias = bias;
   context.macro_regime = regime;
   context.generated_at_utc = generated;
   if(FMC_Number(score))
   {
      context.fundamental_score = StringToDouble(score);
      context.score_available = true;
   }
   if(FMC_Number(policy))
   {
      context.policy_rate_differential_bps = StringToDouble(policy);
      context.policy_differential_available = true;
   }
   if(FMC_Number(real_rate))
   {
      context.real_rate_proxy_differential_bps = StringToDouble(real_rate);
      context.real_rate_proxy_available = true;
   }

   // A non-provider calendar is treated conservatively as a local lockout.
   context.high_impact_lockout = (lockout != "false" || calendar != "PROVIDER"
      || bias == "INSUFFICIENT_EVIDENCE");
   return true;
}

#endif
