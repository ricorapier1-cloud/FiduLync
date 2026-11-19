#ifndef FIDULYNC_EXECUTION_TELEMETRY_MQH
#define FIDULYNC_EXECUTION_TELEMETRY_MQH

// FiduLync MT5 execution telemetry bridge.
// Call CFiduLyncExecutionTelemetry::CaptureTradeTransaction() from the EA's existing OnTradeTransaction.
// Call CFiduLyncExecutionTelemetry::Flush() from a throttled OnTimer (recommended: 5 seconds).
// This module records evidence only; it never sends, modifies or closes orders.

#define FL_TELEMETRY_MAX_PENDING 100
#define FL_TELEMETRY_MAX_REQUESTS 100

struct FLExecutionEvent
{
   string event_id;
   string event_type;
   string symbol;
   string side;
   double fill_price;
   double volume;
   string event_time;
   double requested_price;
   double spread_points;
   double slippage_points;
   long latency_ms;
   long broker_code;
   bool has_requested_price;
   bool has_spread;
   bool has_slippage;
   bool has_latency;
   bool has_broker_code;
};

struct FLRequestContext
{
   ulong request_id;
   ulong order_ticket;
   string symbol;
   string side;
   double requested_price;
   double spread_points;
   ulong sent_tick_ms;
};

class CFiduLyncExecutionTelemetry
{
private:
   string m_base_url;
   string m_token;
   int m_timeout_ms;
   FLExecutionEvent m_events[FL_TELEMETRY_MAX_PENDING];
   int m_event_count;
   FLRequestContext m_requests[FL_TELEMETRY_MAX_REQUESTS];
   int m_request_count;

   string JsonEscape(const string value)
   {
      string output=value;
      StringReplace(output,"\\","\\\\");
      StringReplace(output,"\"","\\\"");
      StringReplace(output,"\r","\\r");
      StringReplace(output,"\n","\\n");
      return output;
   }

   string NumberOrNull(const double value,const bool available,const int digits=8)
   {
      if(!available || !MathIsValidNumber(value)) return "null";
      return DoubleToString(value,digits);
   }

   string IntegerOrNull(const long value,const bool available)
   {
      if(!available) return "null";
      return IntegerToString(value);
   }

   string CreateNonce()
   {
      ulong tick=GetTickCount64();
      uint seconds=(uint)TimeGMT();
      return StringFormat("%08x-%04x-4%03x-8%03x-%08x%04x",
                          (uint)tick,(seconds>>16)&0xffff,seconds&0xfff,
                          ((uint)tick>>16)&0x3ff,seconds,(uint)tick&0xffff);
   }

   string UtcIso(const datetime value)
   {
      // Deal timestamps use broker-server time. Normalize before appending the UTC suffix.
      long serverOffset=(long)TimeCurrent()-(long)TimeGMT();
      datetime utcValue=(datetime)((long)value-serverOffset);
      MqlDateTime utc;
      TimeToStruct(utcValue,utc);
      return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                          utc.year,utc.mon,utc.day,utc.hour,utc.min,utc.sec);
   }

   int FindRequest(const ulong request_id)
   {
      for(int i=0;i<m_request_count;i++)
         if(m_requests[i].request_id==request_id) return i;
      return -1;
   }

   int FindOrder(const ulong order_ticket)
   {
      for(int i=0;i<m_request_count;i++)
         if(m_requests[i].order_ticket==order_ticket) return i;
      return -1;
   }

   void RemoveRequest(const int index)
   {
      if(index<0 || index>=m_request_count) return;
      for(int i=index;i<m_request_count-1;i++) m_requests[i]=m_requests[i+1];
      m_request_count--;
   }

public:
   CFiduLyncExecutionTelemetry()
   {
      m_base_url="";
      m_token="";
      m_timeout_ms=5000;
      m_event_count=0;
      m_request_count=0;
   }

   void Configure(const string base_url,const string publisher_token,const int timeout_ms=5000)
   {
      m_base_url=base_url;
      while(StringLen(m_base_url)>0 && StringSubstr(m_base_url,StringLen(m_base_url)-1,1)=="/")
         m_base_url=StringSubstr(m_base_url,0,StringLen(m_base_url)-1);
      m_token=publisher_token;
      m_timeout_ms=(timeout_ms<1000 ? 1000 : timeout_ms);
   }

   // Call immediately after OrderSend succeeds; order_ticket links DEAL_ADD transactions.
   void RegisterOrderRequest(const ulong request_id,const ulong order_ticket,const string symbol,const string side,
                             const double requested_price,const double spread_points,const ulong sent_tick_ms)
   {
      if(order_ticket==0 || requested_price<0.0 || spread_points<0.0 || (side!="BUY" && side!="SELL")) return;
      int existing=FindOrder(order_ticket);
      if(existing>=0) RemoveRequest(existing);
      existing=FindRequest(request_id);
      if(existing>=0) RemoveRequest(existing);
      if(m_request_count>=FL_TELEMETRY_MAX_REQUESTS) RemoveRequest(0);
      FLRequestContext context;
      context.request_id=request_id;
      context.order_ticket=order_ticket;
      context.symbol=symbol;
      context.side=side;
      context.requested_price=requested_price;
      context.spread_points=MathMax(0.0,spread_points);
      context.sent_tick_ms=(sent_tick_ms>0 ? sent_tick_ms : GetTickCount64());
      m_requests[m_request_count]=context;
      m_request_count++;
   }

   // Invoke this function inside the EA's existing OnTradeTransaction callback.
   void CaptureTradeTransaction(const MqlTradeTransaction &trans,
                                const MqlTradeRequest &request,
                                const MqlTradeResult &result)
   {
      // Keep request context through partial fills; retire it when the broker moves the order to history.
      if(trans.type==TRADE_TRANSACTION_HISTORY_ADD)
      {
         int completedIndex=FindOrder(trans.order);
         if(completedIndex>=0) RemoveRequest(completedIndex);
         return;
      }
      if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || trans.deal==0) return;
      if(!HistoryDealSelect(trans.deal)) return;
      long dealType=HistoryDealGetInteger(trans.deal,DEAL_TYPE);
      if(dealType!=DEAL_TYPE_BUY && dealType!=DEAL_TYPE_SELL) return;
      long entry=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
      string eventType=(entry==DEAL_ENTRY_IN ? "FILL" : "DEAL_CLOSE");
      string symbol=HistoryDealGetString(trans.deal,DEAL_SYMBOL);
      double fillPrice=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
      double volume=HistoryDealGetDouble(trans.deal,DEAL_VOLUME);
      if(symbol=="" || fillPrice<=0.0 || volume<=0.0) return;

      FLExecutionEvent event;
      event.event_id=(string)trans.deal;
      event.event_type=eventType;
      event.symbol=symbol;
      event.side=(dealType==DEAL_TYPE_BUY ? "BUY" : "SELL");
      event.fill_price=fillPrice;
      event.volume=volume;
      datetime dealTime=(datetime)HistoryDealGetInteger(trans.deal,DEAL_TIME);
      event.event_time=UtcIso(dealTime);
      event.requested_price=0.0;
      event.spread_points=0.0;
      event.slippage_points=0.0;
      event.latency_ms=0;
      event.broker_code=0;
      event.has_requested_price=false;
      event.has_spread=false;
      event.has_slippage=false;
      event.has_latency=false;
      event.has_broker_code=(result.retcode>0);

      int contextIndex=FindOrder(trans.order);
      if(contextIndex<0 && result.request_id>0) contextIndex=FindRequest(result.request_id);
      if(contextIndex>=0)
      {
         FLRequestContext context=m_requests[contextIndex];
         if(context.symbol==symbol)
         {
            if(context.requested_price>0.0)
            {
               event.requested_price=context.requested_price;
               event.has_requested_price=true;
               double point=SymbolInfoDouble(symbol,SYMBOL_POINT);
               if(point>0.0)
               {
                  double signedSlippage=(fillPrice-context.requested_price)/point;
                  event.slippage_points=(event.side=="BUY" ? signedSlippage : -signedSlippage);
                  event.has_slippage=true;
               }
            }
            event.spread_points=context.spread_points;
            event.has_spread=true;
            ulong nowMs=GetTickCount64();
            if(nowMs>=context.sent_tick_ms)
            {
               event.latency_ms=(long)(nowMs-context.sent_tick_ms);
               event.has_latency=true;
            }
         }
      }
      event.broker_code=result.retcode;
      if(m_event_count>=FL_TELEMETRY_MAX_PENDING) return;
      m_events[m_event_count]=event;
      m_event_count++;
   }

   // Call from a throttled OnTimer. HTTP is synchronous; never call this every tick.
   bool Flush()
   {
      if(m_event_count<=0) return true;
      if(StringFind(m_base_url,"https://")!=0 || StringFind(m_token,"flmt5_")!=0 || StringLen(m_token)<40)
         return false;
      string json="{\"quotes\":[],\"candles\":[],\"execution_events\":[";
      for(int i=0;i<m_event_count;i++)
      {
         if(i>0) json+=",";
         FLExecutionEvent event=m_events[i];
         json+="{\"account_login\":"+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+",";
         json+="\"event_id\":\""+JsonEscape(event.event_id)+"\",";
         json+="\"event_type\":\""+event.event_type+"\",";
         json+="\"symbol\":\""+JsonEscape(event.symbol)+"\",";
         json+="\"side\":\""+event.side+"\",";
         json+="\"fill_price\":"+DoubleToString(event.fill_price,10)+",";
         json+="\"volume\":"+DoubleToString(event.volume,8)+",";
         json+="\"event_time\":\""+event.event_time+"\",";
         json+="\"requested_price\":"+NumberOrNull(event.requested_price,event.has_requested_price,10)+",";
         json+="\"spread_points\":"+NumberOrNull(event.spread_points,event.has_spread,3)+",";
         json+="\"slippage_points\":"+NumberOrNull(event.slippage_points,event.has_slippage,3)+",";
         json+="\"latency_ms\":"+IntegerOrNull(event.latency_ms,event.has_latency)+",";
         json+="\"broker_code\":"+(event.has_broker_code ? "\""+IntegerToString(event.broker_code)+"\"" : "null")+"}";
      }
      json+="]}";
      char data[];
      int copied=StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8);
      if(copied<=1) return false;
      ArrayResize(data,copied-1);
      char response[];
      string responseHeaders;
      MqlDateTime utc;
      TimeToStruct(TimeGMT(),utc);
      string iso=StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",utc.year,utc.mon,utc.day,utc.hour,utc.min,utc.sec);
      string headers="Content-Type: application/json\r\nAuthorization: Bearer "+m_token+
                     "\r\nx-mt5-timestamp: "+iso+"\r\nx-mt5-nonce: "+CreateNonce()+"\r\n";
      ResetLastError();
      int status=WebRequest("POST",m_base_url+"/api/v1/market-data/ingest",headers,m_timeout_ms,data,response,responseHeaders);
      if(status!=200)
      {
         PrintFormat("FiduLync telemetry upload deferred. HTTP=%d terminal_error=%d",status,GetLastError());
         return false;
      }
      m_event_count=0;
      return true;
   }

   int PendingCount() { return m_event_count; }
};

#endif
