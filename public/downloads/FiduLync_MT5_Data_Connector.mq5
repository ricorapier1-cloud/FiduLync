//+------------------------------------------------------------------+
//| FiduLync MT5 Data Connector                                      |
//| Data-only bridge: closed H1/H4/D1 candles and current bid/ask.    |
//| No trading functions, no account passwords, no order permissions. |
//+------------------------------------------------------------------+
#property strict
#property version   "1.00"
#property description "Sends broker-specific MT5 market observations to FiduLync."

input string InpIngestUrl = "https://fidulync.vercel.app/api/mt5/ingest";
input string InpInstallationToken = "";
input string InpSymbols = ""; // Empty = chart symbol; otherwise comma-separated broker symbols
input int    InpTimerSeconds = 30;
input int    InpBarsPerTimeframe = 200;
input int    InpMaxSymbolsPerRequest = 5;

string g_symbols[];
datetime g_lastSend = 0;

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
   return TimeToString(value,TIME_DATE|TIME_SECONDS);
}

bool AppendCandle(string &json,const string symbol,const ENUM_TIMEFRAMES tf,const string tfName,const int shift)
{
   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   if(CopyRates(symbol,tf,shift,1,rates)!=1) return false;
   MqlRates bar=rates[0];
   if(bar.time<=0 || bar.high<=0 || bar.low<=0 || bar.high<bar.low) return false;
   long spread=(long)SymbolInfoInteger(symbol,SYMBOL_SPREAD);
   long digits=SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   double tickSize=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE);
   double contract=SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE);
   if(StringLen(json)>0) json+=",";
   json+="{\"symbol\":\""+JsonEscape(symbol)+"\",\"timeframe\":\""+tfName+"\",";
   json+="\"bar_time\":\""+IsoTime(bar.time)+"\",";
   json+="\"open\":"+DoubleToString(bar.open,(int)digits)+",\"high\":"+DoubleToString(bar.high,(int)digits)+",";
   json+="\"low\":"+DoubleToString(bar.low,(int)digits)+",\"close\":"+DoubleToString(bar.close,(int)digits)+",";
   json+="\"tick_volume\":"+(string)bar.tick_volume+",\"real_volume\":"+(string)bar.real_volume+",";
   json+="\"spread_points\":"+(string)spread+",\"is_closed\":true,\"digits\":"+(string)digits+",";
   json+="\"point\":"+DoubleToString(point,10)+",\"tick_size\":"+DoubleToString(tickSize,10)+",";
   json+="\"tick_value\":"+DoubleToString(tickValue,8)+",\"contract_size\":"+DoubleToString(contract,4)+"}";
   return true;
}

bool AppendQuote(string &json,const string symbol)
{
   MqlTick tick;
   if(!SymbolInfoTick(symbol,tick) || tick.bid<=0 || tick.ask<tick.bid) return false;
   long digits=SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
   if(point<=0) return false;
   if(StringLen(json)>0) json+=",";
   json+="{\"symbol\":\""+JsonEscape(symbol)+"\",\"bid\":"+DoubleToString(tick.bid,(int)digits)+",";
   json+="\"ask\":"+DoubleToString(tick.ask,(int)digits)+",\"spread_points\":"+DoubleToString((tick.ask-tick.bid)/point,1)+",";
   json+="\"quote_time\":\""+IsoTime((datetime)tick.time)+"\",\"digits\":"+(string)digits+",";
   json+="\"point\":"+DoubleToString(point,10)+",\"tick_size\":"+DoubleToString(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE),10)+",";
   json+="\"tick_value\":"+DoubleToString(SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE),8)+",";
   json+="\"contract_size\":"+DoubleToString(SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE),4)+"}";
   return true;
}

void SendSnapshot()
{
   if(StringLen(InpInstallationToken)<40 || StringLen(InpIngestUrl)<12) return;
   string candles="",quotes="";
   int count=ArraySize(g_symbols);
   for(int i=0;i<count;i++)
   {
      string symbol=g_symbols[i];
      if(!SymbolSelect(symbol,true)) continue;
      AppendCandle(candles,symbol,PERIOD_H1,"H1",1);
      AppendCandle(candles,symbol,PERIOD_H4,"H4",1);
      AppendCandle(candles,symbol,PERIOD_D1,"D1",1);
      AppendQuote(quotes,symbol);
   }
   if(StringLen(candles)==0) return;
   string nonce=StringFormat("%08x-%04x-%04x-%04x-%012x",(uint)GetTickCount(),(uint)(MathRand()%65535),(uint)(MathRand()%65535),(uint)(MathRand()%65535),(uint)TimeLocal());
   string broker=AccountInfoString(ACCOUNT_COMPANY);
   string server=AccountInfoString(ACCOUNT_SERVER);
   string body="{\"nonce\":\""+nonce+"\",\"sent_at\":\""+IsoTime(TimeGMT())+"\",";
   body+="\"broker\":\""+JsonEscape(broker)+"\",\"server\":\""+JsonEscape(server)+"\",";
   body+="\"candles\":["+candles+"],\"quotes\":["+quotes+"]}";
   char data[],result[];
   string headers="Content-Type: application/json\r\nAuthorization: Bearer "+InpInstallationToken+"\r\n";
   StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   ArrayResize(data,ArraySize(data)-1);
   string responseHeaders;
   ResetLastError();
   int status=WebRequest("POST",InpIngestUrl,headers,10000,data,result,responseHeaders);
   if(status<200 || status>=300)
      Print("FiduLync connector HTTP status=",status," error=",GetLastError()," response=",CharArrayToString(result));
   else
      Print("FiduLync connector accepted market data: ",CharArrayToString(result));
}

int OnInit()
{
   if(StringLen(InpInstallationToken)<40)
   {
      Print("Set the unique installation token issued by the FiduLync owner endpoint.");
      return INIT_PARAMETERS_INCORRECT;
   }
   if(StringLen(InpSymbols)==0)
   {
      ArrayResize(g_symbols,1); g_symbols[0]=_Symbol;
   }
   else
   {
      int n=StringSplit(InpSymbols,',',g_symbols);
      if(n<1) return INIT_PARAMETERS_INCORRECT;
      if(n>InpMaxSymbolsPerRequest) ArrayResize(g_symbols,InpMaxSymbolsPerRequest);
      for(int i=0;i<ArraySize(g_symbols);i++) StringTrimLeft(g_symbols[i]),StringTrimRight(g_symbols[i]);
   }
   MathSrand((uint)TimeLocal());
   EventSetTimer((int)MathMax(15,InpTimerSeconds));
   SendSnapshot();
   return INIT_SUCCEEDED;
}

void OnTimer()
{
   SendSnapshot();
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTick()
{
   // Intentionally empty. Polling is timer-throttled and data-only.
}
