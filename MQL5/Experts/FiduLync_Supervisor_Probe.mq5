#property strict
#property version   "1.00"
#property description "FiduLync Personal Quant supervisor connectivity probe. Does not trade."

#include <FiduLync/QuantSupervisor.mqh>

input string InpFiduLyncBaseUrl="https://fidulync.vercel.app";
input string InpInstallationId="";
input string InpCanonicalSymbol=""; // Canonical publisher symbol when broker symbols have suffixes.
input string InpPublisherToken="";
input double InpRequestedRiskPct=0.25;
input int    InpStopDistancePoints=300;
input double InpRewardRisk=2.0;

CFiduLyncQuantSupervisor Supervisor;
datetime LastBarTime=0;

int OnInit()
{
   if(InpInstallationId=="" || InpPublisherToken=="")
   {
      Print("FiduLync probe: enter the installation ID and publisher token from your private owner console.");
      return INIT_PARAMETERS_INCORRECT;
   }
   Supervisor.Configure(InpFiduLyncBaseUrl,InpInstallationId,InpPublisherToken,7000);
   Print("FiduLync supervisor probe initialized. This EA never opens or modifies trades.");
   return INIT_SUCCEEDED;
}

void OnTick()
{
   datetime barTime=iTime(_Symbol,_Period,0);
   if(barTime<=0 || barTime==LastBarTime) return;
   LastBarTime=barTime;

   double point=SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   if(point<=0.0 || ask<=0.0)
   {
      Print("FiduLync probe: quote unavailable; abstaining locally.");
      return;
   }

   double entry=ask;
   double stop=entry-(InpStopDistancePoints*point);
   double target=entry+(InpStopDistancePoints*point*InpRewardRisk);
   string decision,reason;
   double approvedVolume=0.0;
   string canonicalSymbol=(InpCanonicalSymbol=="" ? _Symbol : InpCanonicalSymbol);
   bool approved=Supervisor.RequestDecision(canonicalSymbol,"BUY",entry,stop,target,
                                            InpRequestedRiskPct,AccountInfoInteger(ACCOUNT_LOGIN),
                                            decision,approvedVolume,reason);
   PrintFormat("FiduLync supervisor response: decision=%s approved=%s volume=%.2f reason=%s",
               decision,(approved ? "true" : "false"),approvedVolume,reason);
   // Deliberately no OrderSend call: this is a connectivity and fail-closed probe only.
}
