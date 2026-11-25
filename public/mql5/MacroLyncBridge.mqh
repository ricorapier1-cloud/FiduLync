//+------------------------------------------------------------------+
//| MacroLyncBridge.mqh                                              |
//| Read-only macro context bridge for MT5 Expert Advisors           |
//+------------------------------------------------------------------+
#ifndef MACRO_LYNC_BRIDGE_MQH
#define MACRO_LYNC_BRIDGE_MQH
#property strict
#property version "2.00"

input group "=== MacroLync Read-Only Macro Context ==="
input string InpMacroEndpoint = "https://fidulync.vercel.app/api/v1/macro-context";
input string InpMacroApiToken = ""; // Set to the server-side MACRO_API_TOKEN value
input int    InpMacroTimeoutMs = 7000;
input bool   InpEnableRolloverShield = true; // EA-side execution safeguard only

struct MacroLyncMacroContext
{
   string symbol;
   string fundamental_bias;
   string macro_regime;
   string decision_status;
   string confidence;
   int    bias_score;
   bool   has_bias_score;
   string directional_verdict;
   bool   allowed_to_trade;
   bool   news_lockout_active;
   string active_session;
   string macro_risk_regime;
   string sovereign_shield_status;
   double sovereign_max_risk_pct;
   bool   sovereign_shield_blocked;
   bool   calendar_verified;
   string event_risk_status;
   bool   news_lockout;
   string next_catalyst_title;
   string next_catalyst_utc;
   string source_mode;
   string calendar_source;
   string cot_source;
   string as_of_utc;
   string disclaimer;
};

// Compatibility structure for existing EAs. The bridge deliberately never
// grants execution permission or supplies technical stops/targets.
struct MacroLyncSignal
{
   string symbol;
   string bias;
   string regime;
   string session;
   string correlation_group;
   string roro_regime;
   int    confluence_score;
   double csi_spread;
   string killzone_active;
   double risk_multiplier;
   double atr_sl_pips;
   double atr_tp_pips;
   bool   news_lockout;
   bool   macro_allowed_to_trade;
   bool   safe_to_trade;
   string timestamp_utc;
   string decision_status;
   string confidence;
   bool   calendar_verified;
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
      ushort ch = StringGetCharacter(json, end);
      if(ch == '"' && !escaped) break;
      if(ch == '\\' && !escaped) escaped = true;
      else escaped = false;
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
      ushort ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch <= 32) break;
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
   for(int i = 0; i < length; i++) utf8_data[i] = (uchar)source[i];
   return CharArrayToString(utf8_data, 0, length, CP_UTF8);
}

string ML_BaseUrl(string endpoint)
{
   StringTrimLeft(endpoint);
   StringTrimRight(endpoint);
   while(StringLen(endpoint) > 0 && StringSubstr(endpoint, StringLen(endpoint) - 1, 1) == "/")
      endpoint = StringSubstr(endpoint, 0, StringLen(endpoint) - 1);
   return endpoint;
}

bool ML_IsAllowedBias(const string value)
{
   return value == "BULLISH" || value == "BEARISH" || value == "NEUTRAL" || value == "STRONG_BULLISH" || value == "STRONG_BEARISH";
}

bool ML_FetchMacroContext(const string symbol, const string endpoint, const string token,
                          MacroLyncMacroContext &context, const int timeout_ms)
{
   context.symbol = symbol;
   context.fundamental_bias = "NEUTRAL";
   context.macro_regime = "INSUFFICIENT_EVIDENCE";
   context.decision_status = "INSUFFICIENT_EVIDENCE";
   context.confidence = "INSUFFICIENT_EVIDENCE";
   context.bias_score = 0;
   context.has_bias_score = false;
   context.directional_verdict = "INSUFFICIENT_EVIDENCE";
   context.allowed_to_trade = false;
   context.news_lockout_active = true;
   context.active_session = "CLOSED";
   context.macro_risk_regime = "INSUFFICIENT_EVIDENCE";
   context.sovereign_shield_status = "UNVERIFIED";
   context.sovereign_max_risk_pct = 0.0;
   context.sovereign_shield_blocked = true;
   context.calendar_verified = false;
   context.event_risk_status = "UNVERIFIED_CALENDAR";
   context.news_lockout = true;
   context.next_catalyst_title = "";
   context.next_catalyst_utc = "";
   context.source_mode = "fallback";
   context.calendar_source = "unavailable";
   context.cot_source = "unavailable";
   context.as_of_utc = "";
   context.disclaimer = "Read-only macroeconomic intelligence. No technical analysis or broker order execution.";

   string root = ML_BaseUrl(endpoint);
   if(StringFind(root, "/api/v1/macro-context") < 0) root += "/api/v1/macro-context";
   string normalized_symbol = symbol;
   StringToUpper(normalized_symbol);
   if(root == "" || token == "" || normalized_symbol == "") return false;

   string url = root + "?symbol=" + normalized_symbol;
   string headers = "x-macro-key: " + token + "\r\nAccept: application/json\r\n";
   char request_data[];
   char response_data[];
   string response_headers;
   ArrayResize(request_data, 0);

   ResetLastError();
   int status = WebRequest("GET", url, headers, timeout_ms, request_data, response_data, response_headers);
   int error_code = GetLastError();
   if(status != 200)
   {
      PrintFormat("MacroLync macro-context request returned HTTP %d (GetLastError=%d).", status, error_code);
      return false;
   }

   string response = ML_ResponseToString(response_data);
   StringTrimLeft(response);
   StringTrimRight(response);
   if(response == "") return false;

   string response_symbol = ML_JsonString(response, "symbol");
   string bias = ML_JsonString(response, "fundamental_bias");
   string regime = ML_JsonString(response, "macro_regime");
   string decision = ML_JsonString(response, "decision_status");
   string confidence = ML_JsonString(response, "confidence");
   string score = ML_JsonScalar(response, "biasScore");
   if(score == "") score = ML_JsonScalar(response, "bias_score");
   string directional = ML_JsonString(response, "directionalVerdict");
   string allowed = ML_JsonScalar(response, "allowedToTrade");
   string news_active = ML_JsonScalar(response, "newsLockoutActive");
   string active_session = ML_JsonString(response, "activeSession");
   string macro_risk_regime = ML_JsonString(response, "macroRiskRegime");
   string shield_status = ML_JsonString(response, "status");
   string shield_max_risk = ML_JsonScalar(response, "maxAllowedRiskPct");
   string calendar = ML_JsonScalar(response, "calendar_verified");
   string news = ML_JsonScalar(response, "news_lockout");
   string event_status = ML_JsonString(response, "event_risk_status");
   string source_mode = ML_JsonString(response, "source_mode");
   string calendar_source = ML_JsonString(response, "calendar_source");
   string cot_source = ML_JsonString(response, "cot_source");
   string as_of = ML_JsonString(response, "as_of_utc");

   if(response_symbol != normalized_symbol || !ML_IsAllowedBias(bias) || regime == ""
      || (decision != "INSUFFICIENT_EVIDENCE" && decision != "RESEARCH_CONTEXT_AVAILABLE")
      || (confidence != "HIGH" && confidence != "MODERATE" && confidence != "LOW" && confidence != "INSUFFICIENT_EVIDENCE")
      || (calendar != "true" && calendar != "false")
      || (news != "true" && news != "false")
      || (allowed != "true" && allowed != "false")
      || (news_active != "true" && news_active != "false")
      || (active_session != "LONDON" && active_session != "NY" && active_session != "CLOSED")
      || (directional != "BULLISH" && directional != "BEARISH" && directional != "NEUTRAL" && directional != "INSUFFICIENT_EVIDENCE")
      || macro_risk_regime == ""
      || (event_status != "PROVIDER_CALENDAR" && event_status != "UNVERIFIED_CALENDAR")
      || (source_mode != "fallback" && source_mode != "provider" && source_mode != "partial")
      || (calendar_source != "unavailable" && calendar_source != "reference" && calendar_source != "provider")
      || (cot_source != "unavailable" && cot_source != "provider") || as_of == "")
   {
      Print("MacroLync macro-context payload failed schema validation; EA must abstain.");
      return false;
   }

   context.symbol = response_symbol;
   context.fundamental_bias = bias;
   context.macro_regime = regime;
   context.decision_status = decision;
   context.confidence = confidence;
   context.has_bias_score = score != "" && score != "null";
   context.bias_score = context.has_bias_score ? (int)StringToInteger(score) : 0;
   if(context.has_bias_score && (context.bias_score < -100 || context.bias_score > 100)) return false;
   context.directional_verdict = directional;
   context.news_lockout_active = news_active == "true";
   context.active_session = active_session;
   context.macro_risk_regime = macro_risk_regime;
   context.calendar_verified = calendar == "true";
   context.event_risk_status = event_status;
   context.news_lockout = context.news_lockout_active || news == "true" || !context.calendar_verified || decision == "INSUFFICIENT_EVIDENCE";
   context.allowed_to_trade = allowed == "true" && !context.news_lockout;
   context.next_catalyst_title = ML_JsonString(response, "title");
   context.next_catalyst_utc = ML_JsonString(response, "scheduled_at_utc");
   context.source_mode = source_mode;
   context.calendar_source = calendar_source;
   context.cot_source = cot_source;
   context.as_of_utc = as_of;
   context.disclaimer = ML_JsonString(response, "disclaimer");
   return true;
}

bool MacroLyncGetMacroContext(const string symbol, MacroLyncMacroContext &context)
{
   return ML_FetchMacroContext(symbol, InpMacroEndpoint, InpMacroApiToken, context, InpMacroTimeoutMs);
}

// Backward-compatible read-only adapter. safe_to_trade is always false:
// entries, exits, stops, sizing and execution remain exclusively with the EA.
bool MacroLyncGetSignal(const string symbol, const string endpoint, const string api_token,
                        MacroLyncSignal &signal, const int timeout_ms = 7000)
{
   MacroLyncMacroContext context;
   if(!ML_FetchMacroContext(symbol, endpoint, api_token, context, timeout_ms))
   {
      signal.symbol = symbol;
      signal.bias = "NEUTRAL";
      signal.regime = "INSUFFICIENT_EVIDENCE";
      signal.confluence_score = 0;
      signal.risk_multiplier = 0.0;
      signal.atr_sl_pips = 0.0;
      signal.atr_tp_pips = 0.0;
      signal.news_lockout = true;
      signal.macro_allowed_to_trade = false;
      signal.safe_to_trade = false;
      return false;
   }
   signal.symbol = context.symbol;
   signal.bias = context.fundamental_bias;
   signal.regime = context.macro_regime;
   signal.session = context.active_session;
   signal.correlation_group = "NOT_PROVIDED";
   signal.roro_regime = context.macro_risk_regime;
   signal.confluence_score = context.has_bias_score ? context.bias_score : 0;
   signal.csi_spread = 0.0;
   signal.killzone_active = "NOT_PROVIDED";
   signal.risk_multiplier = 0.0;
   signal.atr_sl_pips = 0.0;
   signal.atr_tp_pips = 0.0;
   signal.news_lockout = context.news_lockout;
   signal.macro_allowed_to_trade = context.allowed_to_trade;
   signal.safe_to_trade = false;
   signal.timestamp_utc = context.as_of_utc;
   signal.decision_status = context.decision_status;
   signal.confidence = context.confidence;
   signal.calendar_verified = context.calendar_verified;
   return true;
}

bool CheckRolloverWindow()
{
   if(!InpEnableRolloverShield) return false;
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   int total_minutes = dt.hour * 60 + dt.min;
   return total_minutes >= 1245 && total_minutes <= 1335;
}

#endif // MACRO_LYNC_BRIDGE_MQH
