'use client'

type Status = 'created' | 'vaulted' | 'fulfilled' | 'released' | 'disputed'

const STAGES = [
  { id: 'created', label: '1. Agreement', desc: 'Safe Link Generated' },
  { id: 'vaulted', label: '2. Vaulting', desc: 'Funds Locked in Escrow' },
  { id: 'fulfilled', label: '3. Fulfillment', desc: 'Item Shipped / Proof Uploaded' },
  { id: 'released', label: '4. Settlement', desc: 'Funds Disbursed to Seller' }
]

export default function EscrowStepper({ currentStatus }: { currentStatus: Status }) {
  const getStageIndex = (status: Status) => {
    switch (status) {
      case 'created': return 0
      case 'vaulted': return 1
      case 'fulfilled': return 2
      case 'released': return 3
      case 'disputed': return 2
      default: return 0
    }
  }

  const activeIndex = getStageIndex(currentStatus)

  return (
    <div className="w-full py-6 bg-slate-900/60 rounded-xl border border-slate-800 p-4">
      {currentStatus === 'disputed' && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg text-center font-medium">
          ⚠️ Transaction is currently under Dispute Review
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < activeIndex
          const isCurrent = idx === activeIndex

          return (
            <div 
              key={stage.id} 
              className={`p-3 rounded-lg transition-all border ${
                isCurrent 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                  : isCompleted 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300' 
                  : 'bg-slate-950/40 border-slate-900 text-slate-600'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider mb-1">{stage.label}</div>
              <div className="text-xs opacity-80">{stage.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
