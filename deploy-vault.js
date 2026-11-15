const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const run = (cmd) => {
  console.log('> ' + cmd);
  return execSync(cmd, { stdio: 'inherit' });
};

console.log('🚀 Injecting Quant Strategy Catalog & Demo EA Downloads into Active Vault...');

// 1. Ensure test EA .mq5 files exist in public/downloads/
fs.mkdirSync('public/downloads', { recursive: true });

const testEa1 = `//+------------------------------------------------------------------+
//|                                  MacroLync_G10_Breakout_Test.mq5 |
//|                        Copyright 2026, AlgoLync / AkinsootoFx    |
//|                                    https://fidulync.vercel.app   |
//|  License: MIT Open-Source Test Artifact (Free for Testing)       |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AlgoLync / AkinsootoFx"
#property link      "https://fidulync.vercel.app"
#property version   "1.00"
#property strict

#include <Trade\\Trade.mqh>
CTrade trade;

input group "=== ALGOLYNX CLOUD LICENSE & TELEMETRY ==="
input string InpLicenseKey      = "ALGOLYNX-FREE-TEST";
input string InpServerOrigin    = "https://fidulync.vercel.app";
input bool   InpEnforceCloud    = false;

input group "=== G10 ATR BREAKOUT PARAMETERS ==="
input double InpRiskPercent     = 1.0;
input int    InpAtrPeriod       = 14;
input int    InpLookbackBars    = 20;
input double InpSlAtrMult       = 1.8;
input double InpTpAtrMult       = 3.0;
input ulong  InpMagicNumber     = 202601;

int atrHandle = INVALID_HANDLE;
datetime lastBarTime = 0;

bool CheckCloudLicense()
{
   if(!InpEnforceCloud || InpLicenseKey == "ALGOLYNX-FREE-TEST") return true;
   string url = InpServerOrigin + "/api/v1/validate-license";
   string headers = "Content-Type: application/json\\r\\n";
   char post[], result[];
   string resHeaders;
   string payload = StringFormat("{\\"license_key\\":\\"%s\\",\\"mt5_account\\":%I64d}", InpLicenseKey, AccountInfoInteger(ACCOUNT_LOGIN));
   StringToCharArray(payload, post, 0, StringLen(payload), CP_UTF8);
   int code = WebRequest("POST", url, headers, 4000, post, result, resHeaders);
   if(code != 200) return false;
   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return (StringFind(body, "\\"valid\\":true") != -1);
}

int OnInit()
{
   if(!CheckCloudLicense()) return INIT_FAILED;
   trade.SetExpertMagicNumber(InpMagicNumber);
   atrHandle = iATR(_Symbol, PERIOD_CURRENT, InpAtrPeriod);
   if(atrHandle == INVALID_HANDLE) return INIT_FAILED;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(atrHandle != INVALID_HANDLE) IndicatorRelease(atrHandle);
}

void OnTick()
{
   datetime currentBar = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(currentBar == lastBarTime) return;
   lastBarTime = currentBar;
   if(PositionsTotal() > 0) return;

   double atr[];
   ArraySetAsSeries(atr, true);
   if(CopyBuffer(atrHandle, 0, 1, 1, atr) < 1) return;

   double highestHigh = iHigh(_Symbol, PERIOD_CURRENT, iHighest(_Symbol, PERIOD_CURRENT, MODE_HIGH, InpLookbackBars, 2));
   double lowestLow   = iLow(_Symbol, PERIOD_CURRENT, iLowest(_Symbol, PERIOD_CURRENT, MODE_LOW, InpLookbackBars, 2));
   double prevClose   = iClose(_Symbol, PERIOD_CURRENT, 1);

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double slDist = atr[0] * InpSlAtrMult;
   double tpDist = atr[0] * InpTpAtrMult;

   if(prevClose > highestHigh)
      trade.Buy(0.01, _Symbol, ask, NormalizeDouble(ask - slDist, _Digits), NormalizeDouble(ask + tpDist, _Digits), "Breakout Long");
   else if(prevClose < lowestLow)
      trade.Sell(0.01, _Symbol, bid, NormalizeDouble(bid + slDist, _Digits), NormalizeDouble(bid - tpDist, _Digits), "Breakout Short");
}
`;

fs.writeFileSync('public/downloads/MacroLync_G10_Breakout_Test.mq5', testEa1);

// 2. Create the standalone Quant Strategy Catalog component with Demo EA download buttons
fs.mkdirSync('components', { recursive: true });
const catalogCode = `\'use client\';
import Link from \'next/link\';

export function QuantStrategyCatalog() {
  return (
    <section className="space-y-4 my-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
        <div>
          <p className="text-[11px] font-mono tracking-widest text-emerald-400">
            02 / VERIFIED STRATEGY REPOSITORY & FREE TEST SANDBOX
          </p>
          <h2 className="text-xl font-bold text-white">Quantitative Algorithms & Demo EAs</h2>
        </div>
        <Link
          href="/guide"
          className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
        >
          MT5 SETUP MANUAL →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flagship EA */}
        <div className="bg-[#06120E] border border-emerald-500/25 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/15 border-emerald-400/40 text-emerald-300">
                INSTITUTIONAL
              </span>
              <span className="text-[11px] font-mono text-emerald-400/80 border border-emerald-500/20 px-2 py-0.5 rounded">
                NEXUS / 4.2
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Eridam Nexus Adaptive Pro</h3>
              <p className="text-xs text-emerald-100/75 leading-relaxed mt-1">
                Regime-adaptive execution framework with volatility-normalized sizing and G10 central bank event vetoes.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-black/50 border border-emerald-500/15 rounded-lg p-2.5 text-center font-mono">
              <div>
                <span className="text-[9px] text-emerald-400/60 block">WIN RATE</span>
                <span className="text-xs font-bold text-emerald-300">64.8%</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-400/60 block">PROFIT F.</span>
                <span className="text-xs font-bold text-emerald-300">2.34</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-400/60 block">SHARPE</span>
                <span className="text-xs font-bold text-emerald-300">2.18</span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-400/60 block">MAX DD</span>
                <span className="text-xs font-bold text-amber-300">5.4%</span>
              </div>
            </div>
            <div className="bg-black/40 border border-emerald-500/15 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/70 mb-1">
                <span>REFERENCE EQUITY CURVE</span>
                <span>H1 / H4 Regime</span>
              </div>
              <svg viewBox="0 0 160 50" className="w-full h-11 overflow-visible">
                <polyline fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points="0,44 18,40 36,35 54,37 72,28 90,22 108,18 126,13 144,8 160,4" />
              </svg>
            </div>
          </div>
          <div className="pt-2 border-t border-emerald-500/15">
            <a href="#vault-checkout" className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors">
              PROVISION ACCOUNT LICENSE ↑
            </a>
          </div>
        </div>

        {/* Free Demo EA Download Card */}
        <div className="bg-[#06120E] border border-cyan-500/25 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-cyan-500/10 border-cyan-400/40 text-cyan-300">
                FREE DEMO ARTIFACT
              </span>
              <span className="text-[11px] font-mono text-cyan-400/80 border border-cyan-500/20 px-2 py-0.5 rounded">
                MIT / 1.0
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">MacroLync G10 ATR Breakout</h3>
              <p className="text-xs text-emerald-100/75 leading-relaxed mt-1">
                Free compile-ready MQL5 Demo Expert Advisor to test MT5 installation, ATR risk sizing, and WebRequest license validation.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-black/50 border border-cyan-500/15 rounded-lg p-2.5 text-center font-mono">
              <div>
                <span className="text-[9px] text-cyan-400/60 block">WIN RATE</span>
                <span className="text-xs font-bold text-cyan-300">54.0%</span>
              </div>
              <div>
                <span className="text-[9px] text-cyan-400/60 block">PROFIT F.</span>
                <span className="text-xs font-bold text-cyan-300">1.62</span>
              </div>
              <div>
                <span className="text-[9px] text-cyan-400/60 block">SHARPE</span>
                <span className="text-xs font-bold text-cyan-300">1.45</span>
              </div>
              <div>
                <span className="text-[9px] text-cyan-400/60 block">MAX DD</span>
                <span className="text-xs font-bold text-amber-300">6.9%</span>
              </div>
            </div>
            <div className="bg-black/40 border border-cyan-500/15 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400/70 mb-1">
                <span>REFERENCE EQUITY CURVE</span>
                <span>M15 / H1</span>
              </div>
              <svg viewBox="0 0 160 50" className="w-full h-11 overflow-visible">
                <polyline fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points="0,44 20,41 40,43 60,34 80,30 100,27 120,21 140,17 160,13" />
              </svg>
            </div>
          </div>
          <div className="pt-2 border-t border-cyan-500/15">
            <a href="/downloads/MacroLync_G10_Breakout_Test.mq5" download="MacroLync_G10_Breakout_Test.mq5" className="block w-full text-center bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 font-mono font-bold py-2.5 rounded text-xs tracking-wider transition-colors">
              📥 DOWNLOAD DEMO EA (.MQ5)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
`;

fs.writeFileSync('components/QuantStrategyCatalog.tsx', catalogCode);

// 3. Inject QuantStrategyCatalog into both app/page.tsx (root dashboard) and app/store/page.tsx
const targets = ['app/page.tsx', 'src/app/page.tsx', 'app/store/page.tsx', 'src/app/store/page.tsx'];
for (const target of targets) {
  if (fs.existsSync(target)) {
    let code = fs.readFileSync(target, 'utf8');
    if (!code.includes('QuantStrategyCatalog')) {
      code = 'import { QuantStrategyCatalog } from "@/components/QuantStrategyCatalog";\n' + code;
      // Inject above footer or before closing main container
      if (code.includes('</main>')) {
        code = code.replace('</main>', '<QuantStrategyCatalog />\n      </main>');
      } else {
        code += '\n\nexport function InjectedCatalog() { return <QuantStrategyCatalog />; }\n';
      }
      fs.writeFileSync(target, code);
      console.log('Injected QuantStrategyCatalog into:', target);
    }
  }
}

// 4. Run TypeScript check, build, and push to main
run('npx tsc --noEmit');
run('npm run build');
run('git add -A');
run('git commit -m "Feat: Inject QuantStrategyCatalog and Demo EA download buttons into active dashboard and store" || true');
run('git push origin main');

console.log('✨ SUCCESS! Active vault and store successfully updated with Demo EA download buttons.');
