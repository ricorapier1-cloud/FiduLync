#property strict
#property version   "1.00"
#property description "MacroLync read-only MT5 account and deal-history publisher"

input group "=== MacroLync Private Account Publisher ==="
input string InpAccountSyncEndpoint = "https://fidulync.vercel.app/api/v1/account-sync";
input string InpAccountIngestToken = ""; // Set to Vercel MT5_ACCOUNT_INGEST_TOKEN
input int    InpSyncIntervalSeconds = 60;
input int    InpHistoryDays = 90;
input int    InpMaxDealsPerSync = 500;
input int    InpRequestTimeoutMs = 10000;

datetime g_last_sync = 0;

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", " ");
   StringReplace(value, "\n", " ");
   StringReplace(value, "\t", " ");
   return value;
}

string UtcIsoNow()
{
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

string BrokerTime(datetime value)
{
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

string AccountMode()
{
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(mode == ACCOUNT_TRADE_MODE_REAL) return "REAL";
   if(mode == ACCOUNT_TRADE_MODE_DEMO) return "DEMO";
   if(mode == ACCOUNT_TRADE_MODE_CONTEST) return "CONTEST";
   return "UNKNOWN";
}

string DealSide(long type)
{
   if(type == DEAL_TYPE_BUY) return "BUY";
   if(type == DEAL_TYPE_SELL) return "SELL";
   if(type == DEAL_TYPE_BALANCE) return "BALANCE";
   if(type == DEAL_TYPE_CREDIT) return "CREDIT";
   if(type == DEAL_TYPE_CHARGE) return "CHARGE";
   if(type == DEAL_TYPE_CORRECTION) return "CORRECTION";
   if(type == DEAL_TYPE_BONUS) return "BONUS";
   return "OTHER";
}

string DealEntry(long entry)
{
   if(entry == DEAL_ENTRY_IN) return "IN";
   if(entry == DEAL_ENTRY_OUT) return "OUT";
   if(entry == DEAL_ENTRY_INOUT) return "INOUT";
   if(entry == DEAL_ENTRY_OUT_BY) return "OUT_BY";
   return "OTHER";
}

string BuildPositions()
{
   string json = "[";
   bool first = true;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      long type = PositionGetInteger(POSITION_TYPE);
      datetime opened = (datetime)PositionGetInteger(POSITION_TIME);
      if(!first) json += ",";
      first = false;

      json += "{";
      json += "\"ticket\":\"" + (string)ticket + "\",";
      json += "\\\"positionId\\\":\\\"" + (string)PositionGetInteger(POSITION_IDENTIFIER) + "\\\",";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"side\":\"" + (type == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
      json += "\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 8) + ",";
      json += "\"openPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 10) + ",";
      json += "\"currentPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), 10) + ",";
      json += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 8) + ",";
      json += "\"swap\":" + DoubleToString(PositionGetDouble(POSITION_SWAP), 8) + ",";
      json += "\"stopLoss\":" + DoubleToString(PositionGetDouble(POSITION_SL), 10) + ",";
      json += "\"takeProfit\":" + DoubleToString(PositionGetDouble(POSITION_TP), 10) + ",";
      json += "\"openedAtServer\":\"" + BrokerTime(opened) + "\",";
      json += "\"magic\":\"" + (string)PositionGetInteger(POSITION_MAGIC) + "\",";
      json += "\"comment\":\"" + JsonEscape(PositionGetString(POSITION_COMMENT)) + "\"";
      json += "}";
   }
   json += "]";
   return json;
}

string BuildDeals()
{
   string json = "[";
   bool first = true;
   datetime to_time = TimeCurrent();
   datetime from_time = to_time - (datetime)(MathMax(1, InpHistoryDays) * 86400);
   if(!HistorySelect(from_time, to_time)) return json + "]";

   int total = HistoryDealsTotal();
   int start = MathMax(0, total - MathMax(1, InpMaxDealsPerSync));
   for(int i = start; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      datetime deal_time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      if(!first) json += ",";
      first = false;

      json += "{";
      json += "\"ticket\":\"" + (string)ticket + "\",";
      json += "\"order\":\"" + (string)HistoryDealGetInteger(ticket, DEAL_ORDER) + "\",";
      json += "\"positionId\":\"" + (string)HistoryDealGetInteger(ticket, DEAL_POSITION_ID) + "\",";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"side\":\"" + DealSide(type) + "\",";
      json += "\"entry\":\"" + DealEntry(entry) + "\",";
      json += "\"volume\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_VOLUME), 8) + ",";
      json += "\"price\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PRICE), 10) + ",";
      json += "\"profit\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PROFIT), 8) + ",";
      json += "\"commission\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 8) + ",";
      json += "\"swap\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_SWAP), 8) + ",";
      json += "\"fee\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_FEE), 8) + ",";
      json += "\"timeServer\":\"" + BrokerTime(deal_time) + "\",";
      json += "\"magic\":\"" + (string)HistoryDealGetInteger(ticket, DEAL_MAGIC) + "\",";
      json += "\"comment\":\"" + JsonEscape(HistoryDealGetString(ticket, DEAL_COMMENT)) + "\"";
      json += "}";
   }
   json += "]";
   return json;
}

string BuildPayload()
{
   string account = "{";
   account += "\"login\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\",";
   account += "\"broker\":\"" + JsonEscape(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   account += "\"server\":\"" + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   account += "\"currency\":\"" + JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)) + "\",";
   account += "\"leverage\":" + (string)AccountInfoInteger(ACCOUNT_LEVERAGE) + ",";
   account += "\"accountMode\":\"" + AccountMode() + "\",";
   account += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 8) + ",";
   account += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 8) + ",";
   account += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 8) + ",";
   account += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 8) + ",";
   account += "\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 8) + ",";
   account += "\"observedAtUtc\":\"" + UtcIsoNow() + "\"";
   account += "}";

   return "{\"account\":" + account + ",\"positions\":" + BuildPositions() + ",\"deals\":" + BuildDeals() + "}";
}

bool PublishAccount()
{
   if(StringLen(InpAccountIngestToken) < 32)
   {
      Print("MacroLync: configure a private ingest token of at least 32 characters.");
      return false;
   }

   string body = BuildPayload();
   char data[];
   int copied = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied <= 1) return false;
   ArrayResize(data, copied - 1);

   char result[];
   string response_headers;
   string request_headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpAccountIngestToken + "\r\n";
   ResetLastError();
   int status = WebRequest("POST", InpAccountSyncEndpoint, request_headers,
      InpRequestTimeoutMs, data, result, response_headers);

   if(status != 200)
   {
      Print("MacroLync account sync failed. HTTP=", status, " terminal_error=", GetLastError());
      return false;
   }

   g_last_sync = TimeCurrent();
   Print("MacroLync account snapshot and deal history synchronized. No trading action was performed.");
   return true;
}

int OnInit()
{
   if(StringLen(InpAccountIngestToken) < 32)
      Print("MacroLync: set InpAccountIngestToken before enabling account synchronization.");
   EventSetTimer((int)MathMax(15, InpSyncIntervalSeconds));
   PublishAccount();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   PublishAccount();
}
