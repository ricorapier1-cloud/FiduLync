import Navbar from '@/components/Navbar';
import DealChat from '@/components/DealChat';
import { Shield, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DealPage({ params }: { params: { id: string } }) {
  const dealId = params.id || 'FD-DEMO';

  return (
    <div className="min-h-screen bg-[#070A0F] text-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest mb-1">
            <Shield size={14} /> Active Escrow Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Deal #{dealId} • Custom EA Development</h1>
        </div>

        {/* State Machine Stepper */}
        <div className="bg-[#111820] border border-gray-800 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-black font-bold mx-auto flex items-center justify-center text-xs">✓</div>
            <div className="text-xs font-bold text-white">Initiated</div>
          </div>
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-black font-bold mx-auto flex items-center justify-center text-xs">✓</div>
            <div className="text-xs font-bold text-white">Funded</div>
          </div>
          <div className="space-y-1">
            <div className="w-8 h-8 rounded-full bg-cyan-500 text-black font-bold mx-auto flex items-center justify-center text-xs animate-pulse">3</div>
            <div className="text-xs font-bold text-cyan-400">Dispatched (48h Clock)</div>
          </div>
          <div className="space-y-1 opacity-40">
            <div className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 font-bold mx-auto flex items-center justify-center text-xs">4</div>
            <div className="text-xs font-bold text-gray-400">Completed</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Summary Box */}
          <div className="lg:col-span-5 bg-[#111820] border border-gray-800 rounded-2xl p-6 space-y-6">
            <div>
              <span className="text-xs text-gray-500 font-mono">LOCKED ESCROW AMOUNT</span>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">₦450,000.00</div>
            </div>

            <div className="p-4 rounded-xl bg-[#070A0F] border border-cyan-500/30 flex items-center gap-3">
              <Clock className="text-cyan-400 w-5 h-5 flex-shrink-0" />
              <div className="text-xs text-cyan-300">
                Auto-Release Clock: <span className="font-bold font-mono text-white">31h 14m remaining</span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-300 border-t border-gray-800/80 pt-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Seller:</span>
                <span className="font-bold text-white">Akinwale (MQL5 Dev)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Buyer:</span>
                <span className="font-bold text-white">QuantTrader_Global</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Inspection Window:</span>
                <span className="font-bold text-emerald-400">48 Hours</span>
              </div>
            </div>

            <button className="w-full py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/20 transition flex items-center justify-center gap-2">
              <AlertTriangle size={15} /> Freeze &amp; File Defect Dispute
            </button>
          </div>

          {/* Right WebSockets Chat Box */}
          <div className="lg:col-span-7">
            <DealChat dealId={dealId} currentUserId="user-demo-id" />
          </div>
        </div>
      </main>
    </div>
  );
}
