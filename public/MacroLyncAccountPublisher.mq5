#property strict
#property version   "1.00"
#property description "MacroLync read-only MT5 account and deal-history publisher"

input group "=== MacroLync Private Account Publisher ==="
input string InpAccountSyncEndpoint = "https://fidulync.vercel.app/api/v1/account-sync";
input string InpAccountIngestToken = ""; // Set to Vercel MT5_ACCOUNT_INGEST_TOKEN
input int    InpSyncIntervalSeconds = 15;
input int    InpHistorySyncIntervalSeconds = 300;
input string InpMarketWatchSymbols = "EURUSD,GBPUSD,USDJPY,XAUUSD";
input int    InpHistoryDays = 90;
input int    InpMaxDealsPerSync = 500;

datetime g_lastHistorySync = 0;
input int    InpRequestTimeoutMs = 10000;

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

datetime ServerTimeToUtc(datetime serverTime)
{
   datetime serverNow = TimeTradeServer();
   datetime utcNow = TimeGMT();
   long offsetSeconds = (long)serverNow - (long)utcNow;
   return (datetime)((long)serverTime - offsetSeconds);
}

int ServerUtcOffsetMinutes()
{
   return (int)MathRound(((long)TimeTradeServer() - (long)TimeGMT()) / 60.0);
}

string IsoUtc(datetime value)
{
   MqlDateTime dt;
   TimeToStruct(value, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

string CanonicalSymbol(string brokerSymbol)
{
   StringToUpper(brokerSymbol);
   string known[4] = {"EURUSD", "GBPUSD", "USDJPY", "XAUUSD"};
   for(int i = 0; i < 4; i++)
      if(StringFind(brokerSymbol, known[i]) == 0) return known[i];
   if(StringLen(brokerSymbol) >= 6) return StringSubstr(brokerSymbol, 0, 6);
   return brokerSymbol;
}

void BuildDailyClosedStats(int &closedTrades, int &losses)
{
   closedTrades = 0;
   losses = 0;
   datetime serverNow = TimeCurrent();
   MqlDateTime day;
   TimeToStruct(serverNow, day);
   day.hour = 0;
   day.min = 0;
   day.sec = 0;
   datetime dayStart = StructToTime(day);
   if(!HistorySelect(dayStart, serverNow))
   {
      closedTrades = -1;
      losses = -1;
      return;
   }

   ulong positionIds[];
   double positionPnl[];
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
      ulong positionId = (ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      if(positionId == 0) continue;
      int index = -1;
      for(int j = 0; j < ArraySize(positionIds); j++)
         if(positionIds[j] == positionId) { index = j; break; }
      if(index < 0)
      {
         index = ArraySize(positionIds);
         ArrayResize(positionIds, index + 1);
         ArrayResize(positionPnl, index + 1);
         positionIds[index] = positionId;
         positionPnl[index] = 0.0;
      }
      positionPnl[index] += HistoryDealGetDouble(ticket, DEAL_PROFIT)
         + HistoryDealGetDouble(ticket, DEAL_COMMISSION)
         + HistoryDealGetDouble(ticket, DEAL_SWAP)
         + HistoryDealGetDouble(ticket, DEAL_FEE);
   }

   for(int i = 0; i < ArraySize(positionIds); i++)
   {
      bool stillOpen = false;
      for(int j = 0; j < PositionsTotal(); j++)
      {
         ulong ticket = PositionGetTicket(j);
         if(ticket == 0) continue;
         if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == positionIds[i])
         {
            stillOpen = true;
            break;
         }
      }
      if(stillOpen) continue;
      closedTrades++;
      if(positionPnl[i] < 0.0) losses++;
   }
}

string BuildOpenCurrencyLegs()
{
   string legs[];
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      string symbol = CanonicalSymbol(PositionGetString(POSITION_SYMBOL));
      if(StringLen(symbol) < 6) continue;
      string candidates[2] = {StringSubstr(symbol, 0, 3), StringSubstr(symbol, 3, 3)};
      for(int j = 0; j < 2; j++)
      {
         bool exists = false;
         for(int k = 0; k < ArraySize(legs); k++)
            if(legs[k] == candidates[j]) { exists = true; break; }
         if(!exists)
         {
            int size = ArraySize(legs);
            ArrayResize(legs, size + 1);
            legs[size] = candidates[j];
         }
      }
   }
   string json = "[";
   for(int i = 0; i < ArraySize(legs); i++)
   {
      if(i > 0) json += ",";
      json += "\"" + JsonEscape(legs[i]) + "\"";
   }
   return json + "]";
}

string BuildQuotes()
{
   string json = "[";
   bool first = true;
   string brokerSymbols[];
   int count = StringSplit(InpMarketWatchSymbols, ',', brokerSymbols);
   for(int i = 0; i < count; i++)
   {
      string brokerSymbol = brokerSymbols[i];
      StringTrimLeft(brokerSymbol);
      StringTrimRight(brokerSymbol);
      if(StringLen(brokerSymbol) < 6 || !SymbolSelect(brokerSymbol, true)) continue;

      MqlTick tick;
      if(!SymbolInfoTick(brokerSymbol, tick) || tick.time <= 0
         || tick.bid <= 0.0 || tick.ask < tick.bid) continue;
      double point = SymbolInfoDouble(brokerSymbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(brokerSymbol, SYMBOL_DIGITS);
      if(point <= 0.0 || digits < 0 || digits > 12) continue;

      string symbol = CanonicalSymbol(brokerSymbol);
      datetime quoteUtc = ServerTimeToUtc(tick.time);
      double spreadPoints = (tick.ask - tick.bid) / point;
      if(!first) json += ",";
      first = false;
      json += "{";
      json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
      json += "\"bid\":" + DoubleToString(tick.bid, digits) + ",";
      json += "\"ask\":" + DoubleToString(tick.ask, digits) + ",";
      json += "\"quoteTimeUtc\":\"" + IsoUtc(quoteUtc) + "\",";
      json += "\"spreadPoints\":" + DoubleToString(spreadPoints, 2) + ",";
      json += "\"digits\":" + IntegerToString(digits) + ",";
      json += "\"point\":" + DoubleToString(point, 12) + ",";
      json += "\"serverUtcOffsetMinutes\":" + IntegerToString(ServerUtcOffsetMinutes()) + ",";
      json += "\"timeBasis\":\"BROKER_SERVER_CURRENT_OFFSET\"";
      json += "}";
   }
   json += "]";
   return json;
}

string AppendCandleSeries(string symbol, ENUM_TIMEFRAMES timeframe, string timeframeName, int barsToCopy, string json, bool &first)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int copied = CopyRates(symbol, timeframe, 1, barsToCopy, rates);
   if(copied <= 0) return json;
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(point <= 0.0 || digits < 0 || digits > 12) return json;

   for(int i = 0; i < copied; i++)
   {
      if(rates[i].time <= 0 || rates[i].open <= 0.0 || rates[i].high < rates[i].low
         || rates[i].open < rates[i].low || rates[i].open > rates[i].high
         || rates[i].close < rates[i].low || rates[i].close > rates[i].high) continue;
      datetime barUtc = ServerTimeToUtc(rates[i].time);
      if(!first) json += ",";
      first = false;
      json += "{";
      json += "\"symbol\":\"" + JsonEscape(CanonicalSymbol(symbol)) + "\",";
      json += "\"timeframe\":\"" + timeframeName + "\",";
      json += "\"barTimeUtc\":\"" + IsoUtc(barUtc) + "\",";
      json += "\"open\":" + DoubleToString(rates[i].open, digits) + ",";
      json += "\"high\":" + DoubleToString(rates[i].high, digits) + ",";
      json += "\"low\":" + DoubleToString(rates[i].low, digits) + ",";
      json += "\"close\":" + DoubleToString(rates[i].close, digits) + ",";
      json += "\"tickVolume\":" + (string)rates[i].tick_volume + ",";
      json += "\"spreadPoints\":" + (string)rates[i].spread + ",";
      json += "\"realVolume\":" + (string)rates[i].real_volume + ",";
      json += "\"isClosed\":true,";
      json += "\"digits\":" + IntegerToString(digits) + ",";
      json += "\"point\":" + DoubleToString(point, 12);
      json += "}";
   }
   return json;
}

string BuildCandles()
{
   string json = "[";
   bool first = true;
   string brokerSymbols[];
   int count = StringSplit(InpMarketWatchSymbols, ',', brokerSymbols);
   for(int i = 0; i < count; i++)
   {
      string brokerSymbol = brokerSymbols[i];
      StringTrimLeft(brokerSymbol);
      StringTrimRight(brokerSymbol);
      if(StringLen(brokerSymbol) < 6 || !SymbolSelect(brokerSymbol, true)) continue;
      json = AppendCandleSeries(brokerSymbol, PERIOD_M5, "M5", 150, json, first);
      json = AppendCandleSeries(brokerSymbol, PERIOD_D1, "D1", 30, json, first);
   }
   json += "]";
   return json;
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
      json += "\"positionId\":\"" + (string)PositionGetInteger(POSITION_IDENTIFIER) + "\",";
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
   int max_deals = (int)MathMin(500, MathMax(1, InpMaxDealsPerSync));
   int start = (int)MathMax(0, total - max_deals);
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

string BuildPayload(bool includeHistory)
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
   account += "\"observedAtUtc\":\"" + UtcIsoNow() + "\",";
   account += "\"serverTime\":\"" + BrokerTime(TimeCurrent()) + "\"";
   account += "}";

   int dailyClosedTrades, dailyLosses;
   BuildDailyClosedStats(dailyClosedTrades, dailyLosses);
   MqlTick currentTick;
   double liveBrokerSpread = -1.0;
   string spreadSymbol = CanonicalSymbol(_Symbol);
   if(SymbolInfoTick(_Symbol, currentTick) && currentTick.ask >= currentTick.bid && currentTick.bid > 0.0)
   {
      double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      if(point > 0.0) liveBrokerSpread = (currentTick.ask - currentTick.bid) / point;
   }
   string deals = includeHistory ? BuildDeals() : "[]";
   return "{\"account\":" + account + ",\"positions\":" + BuildPositions()
      + ",\"deals\":" + deals + ",\"quotes\":" + BuildQuotes()
      + ",\"candles\":" + BuildCandles()
      + ",\"dailyClosedTrades\":" + IntegerToString(dailyClosedTrades)
      + ",\"dailyLosses\":" + IntegerToString(dailyLosses)
      + ",\"dailyStatsTimeBasis\":\"BROKER_SERVER_DAY\""
      + ",\"liveBrokerSpread\":" + (liveBrokerSpread >= 0.0 ? DoubleToString(liveBrokerSpread, 2) : "null")
      + ",\"spreadSymbol\":\"" + JsonEscape(spreadSymbol) + "\""
      + ",\"openCurrencyLegs\":" + BuildOpenCurrencyLegs() + "}";
}

bool PublishAccount(bool includeHistory)
{
   if(StringLen(InpAccountIngestToken) < 32)
   {
      Print("MacroLync: configure a private ingest token of at least 32 characters.");
      return false;
   }

   string body = BuildPayload(includeHistory);
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

   Print("MacroLync account snapshot and deal history synchronized. No trading action was performed.");
   return true;
}

int OnInit()
{
   if(StringLen(InpAccountIngestToken) < 32)
      Print("MacroLync: set InpAccountIngestToken before enabling account synchronization.");
   EventSetTimer((int)MathMax(5, InpSyncIntervalSeconds));
   g_lastHistorySync = TimeCurrent();
   PublishAccount(true);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   datetime now = TimeCurrent();
   bool includeHistory = g_lastHistorySync == 0
      || (now > g_lastHistorySync && now - g_lastHistorySync >= MathMax(60, InpHistorySyncIntervalSeconds));
   if(includeHistory) g_lastHistorySync = now;
   PublishAccount(includeHistory);
}
