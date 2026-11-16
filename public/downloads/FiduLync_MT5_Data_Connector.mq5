//+------------------------------------------------------------------+
//| FiduLync MT5 Data Connector                                      |
//| Data-only: historical closed H1/H4/D1 candles + current quotes.  |
//| No trade functions, account passwords, or trading permissions.   |
//+------------------------------------------------------------------+
#property strict
#property version "1.10"
#property description "Data-only MT5 to FiduLync market data bridge."

input string InpIngestUrl = "https://fidulync.vercel.app/api/mt5/ingest";
input string InpInstallationToken = "";
input string InpSymbols = ""; // Empty = chart symbol; otherwise comma-separated broker symbols
input int InpBarsPerTimeframe = 200;
input int InpTimerSeconds = 30;
input int InpMaxSymbols = 5;

string g_symbols[];

string JsonEscape(const string value)
{
   string out=value;
   StringReplace(out,"\\","\\\\");
   StringReplace(out,"\"","\\\"");
   StringReplace(out,"\r","");
   StringReplace(out,"\n","");
   return out;
}

string IsoTime(const datetime value)
{
   string stamp=TimeToString(value,TIME_DATE|TIME_SECONDS);
   StringReplace(stamp,".","-");
   StringReplace(stamp," ","T");
   return stamp+"Z";
}

string NewNonce()
{
   return StringFormat("%08x-%04x-%04x-%04x-%012x",
      (uint)GetTickCount(),(uint)(MathRand()%65535),(uint)(MathRand()%65535),
      (uint)(MathRand()%65535),(uint)TimeLocal());
}

bool AppendBars(string &json,const string symbol,const ENUM_TIMEFRAMES timeframe,
                const string timeframeName,const int startShift,const int requested)
{
   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   int copied=CopyRates(symbol,timeframe,startShift,requested,rates);
   if(copied<=0) return false;
   long digits=SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   double tickSize=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE);
   double contract=SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE);
   long spread=SymbolInfoInteger(symbol,SYMBOL_SPREAD);
   bool appended=false;
   for(int i=0;i<copied;i++)
   {
      MqlRates bar=rates[i];
      if(bar.time<=0 || bar.low<=0 || bar.high<bar.low ||
         bar.open<bar.low || bar.open>bar.high || bar.close<bar.low || bar.close>bar.high)
         continue;
      if(StringLen(json)>0) json+=",";
      json+="{\"symbol\":\""+JsonEscape(symbol)+"\",\"timeframe\":\""+timeframeName+"\",";
      json+="\"bar_time\":\""+IsoTime(bar.time)+"\",";
      json+="\"open\":"+DoubleToString(bar.open,(int)digits)+",\"high\":"+DoubleToString(bar.high,(int)digits)+",";
      json+="\"low\":"+DoubleToString(bar.low,(int)digits)+",\"close\":"+DoubleToString(bar.close,(int)digits)+",";
      json+="\"tick_volume\":"+(string)bar.tick_volume+",\"real_volume\":"+(string)bar.real_volume+",";
      json+="\"spread_points\":"+(string)spread+",\"is_closed\":true,\"digits\":"+(string)digits+",";
      json+="\"point\":"+DoubleToString(point,10)+",\"tick_size\":"+DoubleToString(tickSize,10)+",";
      json+="\"tick_value\":"+DoubleToString(tickValue,8)+",\"contract_size\":"+DoubleToString(contract,4)+"}";
      appended=true;
   }
   return appended;
}

string BuildQuote(const string symbol)
{
   MqlTick tick;
   if(!SymbolInfoTick(symbol,tick) || tick.bid<=0 || tick.ask<tick.bid) return "";
   datetime quoteTime=(datetime)tick.time;
   if(quoteTime<=0 || TimeGMT()-quoteTime>120 || quoteTime-TimeGMT()>60) return "";
   long digits=SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   if(point<=0) return "";
   string q="{\"symbol\":\""+JsonEscape(symbol)+"\",\"bid\":"+DoubleToString(tick.bid,(int)digits)+",";
   q+="\"ask\":"+DoubleToString(tick.ask,(int)digits)+",\"spread_points\":"+DoubleToString((tick.ask-tick.bid)/point,1)+",";
   q+="\"quote_time\":\""+IsoTime(quoteTime)+"\",\"digits\":"+(string)digits+",";
   q+="\"point\":"+DoubleToString(point,10)+",\"tick_size\":"+DoubleToString(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE),10)+",";
   q+="\"tick_value\":"+DoubleToString(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE),8)+",";
   q+="\"contract_size\":"+DoubleToString(SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE),4)+"}";
   return q;
}

void PostBatch(const string symbol,const ENUM_TIMEFRAMES tf,const string tfName,
               const int startShift,const int count,const bool includeQuote)
{
   string candles="";
   if(!AppendBars(candles,symbol,tf,tfName,startShift,count)) return;
   string quotes="";
   if(includeQuote) quotes=BuildQuote(symbol);
   string body="{\"nonce\":\""+NewNonce()+"\",\"sent_at\":\""+IsoTime(TimeGMT())+"\",";
   body+="\"broker\":\""+JsonEscape(AccountInfoString(ACCOUNT_COMPANY))+"\",";
   body+="\"server\":\""+JsonEscape(AccountInfoString(ACCOUNT_SERVER))+"\",";
   body+="\"candles\":["+candles+"],\"quotes\":[";
   if(StringLen(quotes)>0) body+=quotes;
   body+="]}";
   char data[],result[];
   string headers="Content-Type: application/json\r\nAuthorization: Bearer "+InpInstallationToken+"\r\n";
   StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   ArrayResize(data,ArraySize(data)-1);
   string responseHeaders;
   ResetLastError();
   int status=WebRequest("POST",InpIngestUrl,headers,10000,data,result,responseHeaders);
   if(status<200 || status>=300)
      Print("FiduLync upload failed: HTTP ",status," terminal error ",GetLastError(),
            " response ",CharArrayToString(result));
   else
      Print("FiduLync accepted ",tfName," candles for ",symbol,": ",CharArrayToString(result));
}

void SendSnapshot()
{
   if(StringLen(InpInstallationToken)<40) return;
   int bars=(int)MathMax(200,MathMin(600,InpBarsPerTimeframe));
   for(int i=0;i<ArraySize(g_symbols);i++)
   {
      string symbol=g_symbols[i];
      if(!SymbolSelect(symbol,true)) { Print("Symbol unavailable: ",symbol); continue; }
      PostBatch(symbol,PERIOD_H1,"H1",1,(int)MathMin(150,bars),true);
      if(bars>150) PostBatch(symbol,PERIOD_H1,"H1",151,bars-150,false);
      PostBatch(symbol,PERIOD_H4,"H4",1,MathMin(150,bars),false);
      if(bars>150) PostBatch(symbol,PERIOD_H4,"H4",151,bars-150,false);
      PostBatch(symbol,PERIOD_D1,"D1",1,MathMin(150,bars),false);
      if(bars>150) PostBatch(symbol,PERIOD_D1,"D1",151,bars-150,false);
   }
}

int OnInit()
{
   if(StringLen(InpInstallationToken)<40 || StringLen(InpIngestUrl)<12)
   {
      Print("Set the unique installation token and FiduLync HTTPS endpoint.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(StringLen(InpSymbols)==0)
   {
      ArrayResize(g_symbols,1);
      g_symbols[0]=_Symbol;
   }
   else
   {
      int n=StringSplit(InpSymbols,',',g_symbols);
      if(n<1) return INIT_PARAMETERS_INCORRECT;
      if(n>InpMaxSymbols) ArrayResize(g_symbols,InpMaxSymbols);
      for(int i=0;i<ArraySize(g_symbols);i++)
      {
         StringTrimLeft(g_symbols[i]);
         StringTrimRight(g_symbols[i]);
      }
   }
   MathSrand((uint)TimeLocal());
   EventSetTimer((int)MathMax(15,InpTimerSeconds));
   SendSnapshot();
   return INIT_SUCCEEDED;
}

void OnTimer() { SendSnapshot(); }
void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() { /* Deliberately empty: timer-throttled, data-only connector. */ }
