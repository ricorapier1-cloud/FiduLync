export default function AlgoLyncStore() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-12">
        <h2 className="text-xs text-emerald-400 font-bold tracking-widest uppercase mb-2">ALGOLYNC QUANT SUITE</h2>
        <h1 className="text-4xl font-black text-white mb-4">MQL5 TRADING SYSTEMS</h1>
        <p className="text-gray-400 mb-6">Institutional-grade MetaTrader 5 tools with automated instant delivery.</p>
        
        <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-400 font-medium">
          <span className="flex items-center bg-[#111827] px-3 py-1.5 rounded-full border border-gray-800"><span className="text-emerald-400 mr-1.5">🔒</span> 256-Bit SSL Encrypted</span>
          <span className="flex items-center bg-[#111827] px-3 py-1.5 rounded-full border border-gray-800"><span className="text-emerald-400 mr-1.5">🛡️</span> Secured by Paystack</span>
          <span className="flex items-center bg-[#111827] px-3 py-1.5 rounded-full border border-gray-800"><span className="text-emerald-400 mr-1.5">⚡</span> Instant File Delivery</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#111827] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">Flagship EA</span>
            <span className="text-gray-500 text-sm font-bold">v2.4</span>
          </div>
          <h3 className="text-2xl font-black text-white mb-2">ERIDAM NEXUS ADAPTIVE PRO</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-2xl">Quantitative MT5 EA featuring Kaufman Efficiency Ratio filtering, dynamic ATR envelopes, and high-watermark equity shield.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-[#0B1120] p-4 rounded-xl border border-gray-800">
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">HISTORICAL WIN RATE</div>
              <div className="text-white font-black text-lg">74.2%</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">PROFIT FACTOR</div>
              <div className="text-emerald-400 font-black text-lg">2.14</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">MAX DRAWDOWN</div>
              <div className="text-white font-black text-lg">8.6%</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">AVG MONTHLY ROI</div>
              <div className="text-emerald-400 font-black text-lg">+12.4%</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-800 pt-6">
            <div className="mb-4 sm:mb-0 text-center sm:text-left w-full sm:w-auto">
              <div className="text-xs text-gray-500 mb-1">Single Account License</div>
              <div className="text-2xl font-black text-white">$49 <span className="text-sm text-gray-500 font-medium">USD</span></div>
            </div>
            <div className="flex space-x-4 w-full sm:w-auto">
              <button className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition">Try Demo</button>
              <button className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-emerald-500 text-black font-extrabold hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.3)]">Buy License</button>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <span className="bg-[#0ea5e9]/10 text-[#0ea5e9] text-xs font-bold px-3 py-1 rounded-full border border-[#0ea5e9]/20">Popular Indicator</span>
            <span className="text-gray-500 text-sm font-bold">v1.1</span>
          </div>
          <h3 className="text-2xl font-black text-white mb-2">Z-Score Volatility Envelope Indicator</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-2xl">Custom MT5 Indicator mapping real-time standard deviation breakouts with adaptive ALMA moving average filters.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-[#0B1120] p-4 rounded-xl border border-gray-800">
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">SIGNAL ACCURACY</div>
              <div className="text-white font-black text-lg">81.0%</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">TIMEFRAMES</div>
              <div className="text-white font-black text-lg">M15 - H4</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">ALERT TYPES</div>
              <div className="text-[#0ea5e9] font-black text-lg">Push & Sound</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">REPAINT STATUS</div>
              <div className="text-emerald-400 font-black text-lg">Zero Repaint</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-800 pt-6">
            <div className="mb-4 sm:mb-0 text-center sm:text-left w-full sm:w-auto">
              <div className="text-xs text-gray-500 mb-1">Single Account License</div>
              <div className="text-2xl font-black text-white">$25 <span className="text-sm text-gray-500 font-medium">USD</span></div>
            </div>
            <div className="flex space-x-4 w-full sm:w-auto">
              <button className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition">Try Demo</button>
              <button className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-emerald-500 text-black font-extrabold hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.3)]">Buy License</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
