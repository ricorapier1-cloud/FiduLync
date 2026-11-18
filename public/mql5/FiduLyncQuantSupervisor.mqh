#ifndef FIDULYNC_QUANT_SUPERVISOR_MQH
#define FIDULYNC_QUANT_SUPERVISOR_MQH

// FiduLync Personal Quant Edition — fail-closed EA supervision client.
// This module requests a decision only. It never sends or modifies broker orders.

class CFiduLyncQuantSupervisor
{
private:
   string m_base_url;
   string m_installation_id;
   string m_publisher_token;
   int    m_timeout_ms;

   string JsonEscape(const string value)
   {
      string output=value;
      StringReplace(output,"\\","\\\\");
      StringReplace(output,"\"","\\\"");
      StringReplace(output,"\r","\\r");
      StringReplace(output,"\n","\\n");
      return output;
   }

   string JsonString(const string json,const string key)
   {
      string marker="\""+key+"\":\"";
      int start=StringFind(json,marker);
      if(start<0) return "";
      start+=StringLen(marker);
      int finish=StringFind(json,"\"",start);
      if(finish<0) return "";
      return StringSubstr(json,start,finish-start);
   }

   double JsonNumber(const string json,const string key)
   {
      string marker="\""+key+"\":";
      int start=StringFind(json,marker);
      if(start<0) return 0.0;
      start+=StringLen(marker);
      int finish=start;
      while(finish<StringLen(json))
      {
         ushort ch=StringGetCharacter(json,finish);
         if(ch==',' || ch=='}' || ch==' ' || ch=='\r' || ch=='\n') break;
         finish++;
      }
      return StringToDouble(StringSubstr(json,start,finish-start));
   }

public:
   void Configure(const string base_url,const string installation_id,const string publisher_token,const int timeout_ms=5000)
   {
      m_base_url=base_url;
      while(StringLen(m_base_url)>0 && StringSubstr(m_base_url,StringLen(m_base_url)-1,1)=="/")
         m_base_url=StringSubstr(m_base_url,0,StringLen(m_base_url)-1);
      m_installation_id=installation_id;
      m_publisher_token=publisher_token;
      m_timeout_ms=(timeout_ms<1000 ? 1000 : timeout_ms);
   }

   bool RequestDecision(const string symbol,const string side,const double entry_price,
                        const double stop_loss,const double take_profit,const double requested_risk_pct,
                        const long account_login,string &decision,double &approved_volume,string &reason)
   {
      decision="ABSTAIN";
      approved_volume=0.0;
      reason="SUPERVISOR_NOT_CONFIGURED";
      if(StringFind(m_base_url,"https://")!=0 || StringLen(m_installation_id)<8
         || StringFind(m_publisher_token,"flmt5_")!=0 || StringLen(m_publisher_token)<40)
         return false;
      if(account_login<=0 || (side!="BUY" && side!="SELL") || entry_price<=0.0
         || stop_loss<=0.0 || take_profit<=0.0 || requested_risk_pct<=0.0)
      {
         reason="INVALID_LOCAL_PROPOSAL";
         return false;
      }

      string request_id=StringFormat("%I64d-%u",(long)TimeGMT(),GetTickCount());
      string json=StringFormat(
         "{\"account_login\":%I64d,\"proposal\":{\"requestId\":\"%s\",\"installationId\":\"%s\",\"symbol\":\"%s\",\"side\":\"%s\",\"entryPrice\":%.10f,\"stopLoss\":%.10f,\"takeProfit\":%.10f,\"requestedRiskPct\":%.4f}}",
         account_login,request_id,JsonEscape(m_installation_id),JsonEscape(symbol),side,
         entry_price,stop_loss,take_profit,requested_risk_pct);

      char data[];
      int copied=StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8);
      if(copied<=1)
      {
         reason="REQUEST_ENCODING_FAILED";
         return false;
      }
      ArrayResize(data,copied-1);
      char response[];
      string response_headers;
      string headers="Content-Type: application/json\r\n";
      headers+="Authorization: Bearer "+m_publisher_token+"\r\n";
      headers+="x-mt5-timestamp: "+TimeToString(TimeGMT(),TIME_DATE|TIME_SECONDS)+"\r\n";
      // ISO-8601 UTC timestamp required by the API.
      MqlDateTime utc;
      TimeToStruct(TimeGMT(),utc);
      string iso=StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",utc.year,utc.mon,utc.day,utc.hour,utc.min,utc.sec);
      headers="Content-Type: application/json\r\nAuthorization: Bearer "+m_publisher_token+
              "\r\nx-mt5-timestamp: "+iso+"\r\nx-mt5-nonce: "+CreateNonce()+"\r\n";

      ResetLastError();
      int status=WebRequest("POST",m_base_url+"/api/v1/ea-supervisor/decision",headers,m_timeout_ms,data,response,response_headers);
      if(status!=200)
      {
         reason=(status<0 ? "WEBREQUEST_FAILED_"+IntegerToString(GetLastError()) : "SUPERVISOR_HTTP_"+IntegerToString(status));
         return false;
      }

      string payload=CharArrayToString(response,0,-1,CP_UTF8);
      decision=JsonString(payload,"decision");
      approved_volume=JsonNumber(payload,"approvedVolume");
      reason=JsonString(payload,"blockers");
      if(decision!="APPROVE" || approved_volume<=0.0)
      {
         approved_volume=0.0;
         if(decision=="") decision="ABSTAIN";
         reason="SUPERVISOR_"+decision;
         return false;
      }
      reason="SUPERVISOR_APPROVED";
      return true;
   }

   string CreateNonce()
   {
      // UUID-shaped per-request nonce; uniqueness is the security requirement.
      uint a=GetTickCount();
      uint b=(uint)TimeLocal();
      return StringFormat("%08x-%04x-4%03x-8%03x-%08x%04x",
                          a,(b>>16)&0xffff,b&0xfff,(a>>16)&0x3ff,b,a&0xffff);
   }
};

#endif
