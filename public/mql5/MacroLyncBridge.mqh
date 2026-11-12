#ifndef MACRO_LYNC_BRIDGE_MQH
#define MACRO_LYNC_BRIDGE_MQH

struct MacroLyncSignal
{
   string symbol;
   string bias;
   string regime;
   int confluence_score;
   double atr_sl_pips;
   double atr_tp_pips;
   bool news_lockout;
   bool safe_to_trade;
   string timestamp_utc;
};

string ML_JsonString(const string json, const string key)
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
   bool escaped = false;
   while(end < StringLen(json))
   {
      ushort character = StringGetCharacter(json, end);
      if(character == '"' && !escaped) break;
      if(character == '\\' && !escaped)
         escaped = true;
      else
         escaped = false;
      end++;
   }
   if(end >= StringLen(json)) return "";
   return StringSubstr(json, start, end - start);
}

string ML_JsonScalar(const string json, const string key)
{
   string needle = "\"" + key + "\"";
   int key_position = StringFind(json, needle);
   if(key_position < 0) return "";
   int colon = StringFind(json, ":", key_position + StringLen(needle));
   if(colon < 0) return "";
   int start = colon + 1;
   while(start < StringLen(json) && StringGetCharacter(json, start) <= 32) start++;
   if(start >= StringLen(json)) return "";
   int end = start;
   while(end < StringLen(json))
   {
      ushort character = StringGetCharacter(json, end);
      if(character == ',' || character == '}' || character <= 32) break;
      end++;
   }
   return StringSubstr(json, start, end - start);
}

string ML_ResponseToString(const char &source[])
{
   int length = ArraySize(source);
   if(length <= 0) return "";

   uchar utf8_data[];
   if(ArrayResize(utf8_data, length) != length) return "";
   for(int index = 0; index < length; index++)
      utf8_data[index] = (uchar)source[index];
   return CharArrayToString(utf8_data, 0, length, CP_UTF8);
}

bool ML_EncodeRequestBody(const string body, char &request_data[])
{
   uchar utf8_data[];
   int length = StringToCharArray(body, utf8_data, 0, WHOLE_ARRAY, CP_UTF8);
   if(length <= 1) return false;

   int payload_length = length - 1;
   if(ArrayResize(request_data, payload_length) != payload_length) return false;
   for(int index = 0; index < payload_length; index++)
      request_data[index] = (char)utf8_data[index];
   return true;
}

bool ML_IsNumber(const string value)
{
   int length = StringLen(value);
   if(length == 0) return false;
   int start = StringGetCharacter(value, 0) == '-' ? 1 : 0;
   if(start == length) return false;
   bool has_digit = false;
   bool has_decimal = false;
   for(int index = start; index < length; index++)
   {
      ushort character = StringGetCharacter(value, index);
      if(character >= '0' && character <= '9')
      {
         has_digit = true;
         continue;
      }
      if(character == '.' && !has_decimal)
      {
         has_decimal = true;
         continue;
      }
      return false;
   }
   return has_digit;
}

bool ML_IsInteger(const string value)
{
   if(value == "") return false;
   int start = StringGetCharacter(value, 0) == '-' ? 1 : 0;
   if(start == StringLen(value)) return false;
   for(int index = start; index < StringLen(value); index++)
   {
      ushort character = StringGetCharacter(value, index);
      if(character < '0' || character > '9') return false;
   }
   return true;
}

string ML_JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\b", "\\b");
   StringReplace(value, "\f", "\\f");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\t", "\\t");
   StringReplace(value, "\n", "\\n");
   return value;
}

string ML_BaseUrl(string base_url)
{
   StringTrimLeft(base_url);
   StringTrimRight(base_url);
   while(StringLen(base_url) > 0 && StringSubstr(base_url, StringLen(base_url) - 1, 1) == "/")
      base_url = StringSubstr(base_url, 0, StringLen(base_url) - 1);
   return base_url;
}

bool MacroLyncGetSignal(
   const string symbol,
   const string base_url,
   const string api_key,
   MacroLyncSignal &signal,
   const int timeout_ms = 5000
)
{
   signal.symbol = symbol;
   signal.bias = "NEUTRAL";
   signal.regime = "UNAVAILABLE";
   signal.confluence_score = 0;
   signal.atr_sl_pips = 0.0;
   signal.atr_tp_pips = 0.0;
   signal.news_lockout = true;
   signal.safe_to_trade = false;
   signal.timestamp_utc = "";

   string root = ML_BaseUrl(base_url);
   if(root == "" || api_key == "") return false;
   string url = root + "/api/v1/macro-signal?symbol=" + symbol;
   string headers = "x-algo-key: " + api_key + "\r\nAccept: application/json\r\n";
   char request_data[];
   char response_data[];
   string response_headers;
   ArrayResize(request_data, 0);

   ResetLastError();
   int status = WebRequest("GET", url, headers, timeout_ms, request_data, response_data, response_headers);
   int error_code = GetLastError();
   if(status != 200)
   {
      PrintFormat("MacroLync signal request returned HTTP %d (GetLastError=%d).", status, error_code);
      signal.news_lockout = true;
      signal.safe_to_trade = false;
      return false;
   }

   string response = ML_ResponseToString(response_data);
   StringTrimLeft(response);
   StringTrimRight(response);
   if(response == "")
   {
      PrintFormat("MacroLync signal request returned an empty payload (GetLastError=%d).", error_code);
      signal.news_lockout = true;
      signal.safe_to_trade = false;
      return false;
   }
   string response_symbol = ML_JsonString(response, "symbol");
   string response_bias = ML_JsonString(response, "bias");
   string response_regime = ML_JsonString(response, "regime");
   string response_score = ML_JsonScalar(response, "confluence_score");
   string response_sl = ML_JsonScalar(response, "atr_sl_pips");
   string response_tp = ML_JsonScalar(response, "atr_tp_pips");
   string response_safe = ML_JsonScalar(response, "safe_to_trade");
   string response_news = ML_JsonScalar(response, "news_lockout");
   string response_timestamp = ML_JsonString(response, "timestamp_utc");
   if(response_symbol != symbol
      || (response_bias != "LONG" && response_bias != "SHORT" && response_bias != "NEUTRAL")
      || (response_regime != "TRENDING_EXPANSION" && response_regime != "MEAN_REVERTING"
         && response_regime != "HIGH_VOL_CHOP" && response_regime != "UNAVAILABLE")
      || !ML_IsInteger(response_score)
      || (response_safe != "true" && response_safe != "false")
      || (response_news != "true" && response_news != "false")
      || response_timestamp == "")
   {
      signal.news_lockout = true;
      signal.safe_to_trade = false;
      return false;
   }
   int confluence_score = (int)StringToInteger(response_score);
   bool atr_values_valid = (response_sl == "null" || ML_IsNumber(response_sl))
      && (response_tp == "null" || ML_IsNumber(response_tp));
   if(confluence_score < -100 || confluence_score > 100 || !atr_values_valid
      || (response_safe == "true" && (response_sl == "null" || response_tp == "null"
         || response_news == "true" || response_bias == "NEUTRAL"
         || StringToDouble(response_sl) <= 0.0 || StringToDouble(response_tp) <= 0.0
         || (response_regime != "TRENDING_EXPANSION" && response_regime != "MEAN_REVERTING"))))
   {
      signal.news_lockout = true;
      signal.safe_to_trade = false;
      return false;
   }

   signal.symbol = response_symbol;
   signal.bias = response_bias;
   signal.regime = response_regime;
   signal.confluence_score = confluence_score;
   signal.atr_sl_pips = response_sl == "" || response_sl == "null" ? 0.0 : StringToDouble(response_sl);
   signal.atr_tp_pips = response_tp == "" || response_tp == "null" ? 0.0 : StringToDouble(response_tp);
   signal.news_lockout = response_news == "true";
   signal.safe_to_trade = response_safe == "true" && !signal.news_lockout;
   signal.timestamp_utc = response_timestamp;
   return true;
}

bool MacroLyncSendHeartbeat(
   const string base_url,
   const string api_key,
   const string ea_name,
   const string account_number,
   const double balance,
   const double equity,
   const double floating_pnl,
   const double drawdown_pct,
   const int open_positions,
   const string status = "RUNNING",
   const int timeout_ms = 5000
)
{
   string root = ML_BaseUrl(base_url);
   if(root == "" || api_key == "") return false;
   string body = "{\"ea_name\":\"" + ML_JsonEscape(ea_name)
      + "\",\"account_number\":\"" + ML_JsonEscape(account_number)
      + "\",\"balance\":" + DoubleToString(balance, 2)
      + ",\"equity\":" + DoubleToString(equity, 2)
      + ",\"floating_pnl\":" + DoubleToString(floating_pnl, 2)
      + ",\"drawdown_pct\":" + DoubleToString(drawdown_pct, 2)
      + ",\"open_positions\":" + IntegerToString(open_positions)
      + ",\"status\":\"" + ML_JsonEscape(status) + "\"}";
   char request_data[];
   char response_data[];
   string response_headers;
   if(!ML_EncodeRequestBody(body, request_data))
   {
      Print("MacroLync heartbeat request body could not be encoded as UTF-8.");
      return false;
   }
   string headers = "x-algo-key: " + api_key + "\r\nContent-Type: application/json\r\nAccept: application/json\r\n";
   ResetLastError();
   int status = WebRequest("POST", root + "/api/v1/ea-heartbeat", headers, timeout_ms, request_data, response_data, response_headers);
   int error_code = GetLastError();
   if(status != 202)
   {
      PrintFormat("MacroLync heartbeat request returned HTTP %d (GetLastError=%d).", status, error_code);
      return false;
   }
   return true;
}

void MacroLyncHeartbeatEveryFiveMinutes(
   const string base_url,
   const string api_key,
   const string ea_name,
   const string account_number,
   const double balance,
   const double equity,
   const double floating_pnl,
   const double drawdown_pct,
   const int open_positions,
   const string status = "RUNNING"
)
{
   static datetime last_attempt = 0;
   datetime now = TimeLocal();
   if(last_attempt != 0 && now - last_attempt < 300) return;
   last_attempt = now;
   MacroLyncSendHeartbeat(
      base_url,
      api_key,
      ea_name,
      account_number,
      balance,
      equity,
      floating_pnl,
      drawdown_pct,
      open_positions,
      status
   );
}

#endif
