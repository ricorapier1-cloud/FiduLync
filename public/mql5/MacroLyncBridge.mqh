#ifndef MACRO_LYNC_BRIDGE_MQH
#define MACRO_LYNC_BRIDGE_MQH
#property strict

struct MacroLyncSignal
{
   string symbol;
   string bias;
   string regime;
   string session;
   string correlation_group;
   string roro_regime;
   int confluence_score;
   double csi_spread;
   string killzone_active;
   double risk_multiplier;
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
   signal.session = "OFF_HOURS";
   signal.killzone_active = "OFF_SESSION";
   signal.correlation_group = "USD_BLOC";
   signal.confluence_score = 0;
   signal.csi_spread = 0.0;
   signal.risk_multiplier = 0.0;
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
   string response_session = ML_JsonString(response, "session");
   string response_correlation_group = ML_JsonString(response, "correlation_group");
   string response_killzone = ML_JsonString(response, "killzone_active");
   string response_score = ML_JsonScalar(response, "confluence_score");
   string response_csi_spread = ML_JsonScalar(response, "csi_spread");
   string response_risk_multiplier = ML_JsonScalar(response, "risk_multiplier");
   string response_sl = ML_JsonScalar(response, "atr_sl_pips");
   string response_tp = ML_JsonScalar(response, "atr_tp_pips");
   string response_safe = ML_JsonScalar(response, "safe_to_trade");
   string response_news = ML_JsonScalar(response, "news_lockout");
   string response_timestamp = ML_JsonString(response, "timestamp_utc");
   if(response_symbol != symbol
      || (response_bias != "LONG" && response_bias != "SHORT" && response_bias != "NEUTRAL")
      || (response_regime != "TRENDING_EXPANSION" && response_regime != "MEAN_REVERTING"
         && response_regime != "HIGH_VOL_CHOP" && response_regime != "UNAVAILABLE")
      || (response_session != "ASIAN_RANGE" && response_session != "LONDON_KILLZONE"
         && response_session != "NY_OVERLAP" && response_session != "OFF_HOURS")
      || (response_correlation_group != "USD_BLOC" && response_correlation_group != "JPY_CROSS"
         && response_correlation_group != "EUR_BLOC" && response_correlation_group != "COMMODITY_FX")
      || (response_killzone != "LONDON_OPEN" && response_killzone != "NY_OVERLAP"
         && response_killzone != "ASIAN_RANGE" && response_killzone != "OFF_SESSION")
      || !ML_IsInteger(response_score)
      || !ML_IsNumber(response_csi_spread)
      || !ML_IsNumber(response_risk_multiplier)
      || (response_safe != "true" && response_safe != "false")
      || (response_news != "true" && response_news != "false")
      || response_timestamp == "")
   {
      signal.news_lockout = true;
      signal.safe_to_trade = false;
      return false;
   }
   int confluence_score = (int)StringToInteger(response_score);
   double csi_spread = StringToDouble(response_csi_spread);
   double risk_multiplier = StringToDouble(response_risk_multiplier);
   double expected_risk_multiplier = response_news == "true" || response_regime == "HIGH_VOL_CHOP"
      || response_regime == "UNAVAILABLE"
      ? 0.0
      : response_regime == "TRENDING_EXPANSION" ? 1.0 : 0.5;
   bool atr_values_valid = (response_sl == "null" || ML_IsNumber(response_sl))
      && (response_tp == "null" || ML_IsNumber(response_tp));
   if(confluence_score < -100 || confluence_score > 100 || MathAbs(csi_spread) > 200.0
      || risk_multiplier != expected_risk_multiplier
      || !atr_values_valid
      || (response_safe == "true" && (response_sl == "null" || response_tp == "null"
         || response_news == "true" || response_bias == "NEUTRAL"
         || risk_multiplier <= 0.0 || MathAbs(csi_spread) < 60.0 || MathAbs(confluence_score) < 45
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
   signal.session = response_session;
   signal.killzone_active = response_killzone;
   signal.correlation_group = response_correlation_group;
   signal.confluence_score = confluence_score;
   signal.csi_spread = csi_spread;
   signal.risk_multiplier = risk_multiplier;
   signal.atr_sl_pips = response_sl == "" || response_sl == "null" ? 0.0 : StringToDouble(response_sl);
   signal.atr_tp_pips = response_tp == "" || response_tp == "null" ? 0.0 : StringToDouble(response_tp);
   signal.news_lockout = response_news == "true";
   signal.safe_to_trade = response_safe == "true" && !signal.news_lockout;
   signal.timestamp_utc = response_timestamp;
   return true;
}

bool LogClosedTrade(
   const string base_url,
   const string api_key,
   const string ticket,
   const string symbol,
   const string direction,
   const double entry_price,
   const double exit_price,
   const double profit_usd,
   const double r_multiple,
   const int confluence_score,
   const string regime,
   const string closed_at_utc,
   const int timeout_ms = 5000
)
{
   string root = ML_BaseUrl(base_url);
   if(root == "" || api_key == "" || ticket == "" || symbol == ""
      || (direction != "LONG" && direction != "SHORT")
      || !MathIsValidNumber(entry_price) || entry_price <= 0.0
      || !MathIsValidNumber(exit_price) || exit_price <= 0.0
      || !MathIsValidNumber(profit_usd) || !MathIsValidNumber(r_multiple)
      || closed_at_utc == "" || StringSubstr(closed_at_utc, StringLen(closed_at_utc) - 1, 1) != "Z"
      || confluence_score < -100 || confluence_score > 100)
      return false;
   string body = "{\"ticket\":\"" + ML_JsonEscape(ticket)
      + "\",\"symbol\":\"" + ML_JsonEscape(symbol)
      + "\",\"direction\":\"" + direction
      + "\",\"entry_price\":" + DoubleToString(entry_price, 8)
      + ",\"exit_price\":" + DoubleToString(exit_price, 8)
      + ",\"profit_usd\":" + DoubleToString(profit_usd, 2)
      + ",\"r_multiple\":" + DoubleToString(r_multiple, 4)
      + ",\"confluence_score\":" + IntegerToString(confluence_score)
      + ",\"regime\":\"" + ML_JsonEscape(regime)
      + "\",\"closed_at_utc\":\"" + ML_JsonEscape(closed_at_utc) + "\"}";
   char request_data[];
   char response_data[];
   string response_headers;
   if(!ML_EncodeRequestBody(body, request_data))
   {
      Print("MacroLync closed-trade request body could not be encoded as UTF-8.");
      return false;
   }
   string headers = "x-algo-key: " + api_key + "\r\nContent-Type: application/json\r\nAccept: application/json\r\n";
   ResetLastError();
   int status = WebRequest("POST", root + "/api/v1/trade-log", headers, timeout_ms, request_data, response_data, response_headers);
   int error_code = GetLastError();
   if(status != 202 && status != 200)
   {
      PrintFormat("MacroLync closed-trade request returned HTTP %d (GetLastError=%d).", status, error_code);
      return false;
   }
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


//+------------------------------------------------------------------+
//| Local UTC Rollover Guard (20:45 - 22:15 UTC)                     |
//+------------------------------------------------------------------+
bool IsLocalRolloverWindow()
{
   MqlDateTime dt;
   TimeGMT(dt);
   int mins = dt.hour * 60 + dt.min;
   return (mins >= 1245 && mins <= 1335);
}

//+------------------------------------------------------------------+
//| Offline Strategy Tester Macro Regime Simulator                   |
//| Runs automatically when MQLInfoInteger(MQL_TESTER) is true       |
//+------------------------------------------------------------------+
bool SimulateTesterSignal(const string symbol, MacroSignal &outSignal)
{
   outSignal.Reset();
   outSignal.symbol = symbol;
   outSignal.rollover_blackout = IsLocalRolloverWindow();

   // Block illiquid Scandinavian crosses automatically
   if(StringFind(symbol, "NOK") >= 0 || StringFind(symbol, "SEK") >= 0)
   {
      outSignal.safe_to_trade = false;
      outSignal.bias = "NEUTRAL";
      return true;
   }

   // Use D1 EMA-20 vs EMA-50 + H4 ADX + H1 ATR as deterministic offline macro proxy
   int hFast = iMA(symbol, PERIOD_D1, 20, 0, MODE_EMA, PRICE_CLOSE);
   int hSlow = iMA(symbol, PERIOD_D1, 50, 0, MODE_EMA, PRICE_CLOSE);
   int hAdx  = iADX(symbol, PERIOD_H4, 14);
   int hAtr  = iATR(symbol, PERIOD_H1, 14);

   double fast[], slow[], adx[], atr[];
   ArraySetAsSeries(fast, true);
   ArraySetAsSeries(slow, true);
   ArraySetAsSeries(adx, true);
   ArraySetAsSeries(atr, true);

   if(CopyBuffer(hFast, 0, 0, 2, fast) < 2 ||
      CopyBuffer(hSlow, 0, 0, 2, slow) < 2 ||
      CopyBuffer(hAdx,  0, 0, 2, adx)  < 2 ||
      CopyBuffer(hAtr,  0, 0, 2, atr)  < 2)
   {
      IndicatorRelease(hFast); IndicatorRelease(hSlow);
      IndicatorRelease(hAdx);  IndicatorRelease(hAtr);
      return false;
   }

   double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int    digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double pipMult = (digits == 3 || digits == 5) ? 10.0 : 1.0;

   double spreadPct = (slow[0] > 0.0) ? ((fast[0] - slow[0]) / slow[0]) * 100.0 : 0.0;
   outSignal.atr_sl_pips = (point > 0.0) ? (atr[0] * 1.5) / (point * pipMult) : 25.0;
   outSignal.news_lockout = false;

   if(adx[0] >= 22.0 && MathAbs(spreadPct) >= 0.35)
   {
      outSignal.regime = "TRENDING_EXPANSION";
      outSignal.bias   = (spreadPct > 0.0) ? "LONG" : "SHORT";
      outSignal.roro_regime = (spreadPct > 0.0) ? "RISK_ON" : "RISK_OFF";
      outSignal.confluence_score = MathMin(95.0, 65.0 + adx[0] * 0.6);
      outSignal.risk_multiplier  = (adx[0] >= 30.0) ? 1.0 : 0.75;
      outSignal.safe_to_trade    = !outSignal.rollover_blackout;
   }
   else
   {
      outSignal.regime = "MEAN_REVERTING";
      outSignal.bias   = "NEUTRAL";
      outSignal.roro_regime = "NEUTRAL";
      outSignal.confluence_score = 40.0;
      outSignal.risk_multiplier  = 0.0;
      outSignal.safe_to_trade    = false;
   }

   IndicatorRelease(hFast); IndicatorRelease(hSlow);
   IndicatorRelease(hAdx);  IndicatorRelease(hAtr);
   return true;
}
