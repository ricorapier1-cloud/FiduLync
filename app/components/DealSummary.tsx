interface DealProps {
  itemName: string; itemPrice: string; buyerPhone: string; currency: string
}

const SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€', KES: 'KSh ', GHS: 'GH₵ ', ZAR: 'R '
}

export default function DealSummary({ itemName, itemPrice, buyerPhone, currency }: DealProps) {
  const symbol = SYMBOLS[currency] || currency + ' '

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
        MARKET SUMMARY <span className="bg-[#111827] text-emerald-400 px-2 py-1 rounded text-[10px] border border-gray-800 shadow-sm">Escrow Shield Active</span>
      </h3>
      
      <div className="bg-[#111827] p-6 rounded-3xl border border-gray-800 shadow-xl sticky top-24">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Asset / Item</p>
          <p className="text-lg font-bold text-white break-words">{itemName || 'Awaiting input...'}</p>
        </div>
        
        <div className="flex justify-between items-end mb-6 bg-[#0B1120] p-4 rounded-xl border border-gray-800">
          <div>
            <p className="text-xs text-gray-500 mb-1">Locked Amount</p>
            <p className="text-3xl font-black text-emerald-400">{symbol}{Number(itemPrice || 0).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Buyer Contact</p>
            <p className="text-sm font-bold text-gray-300">{buyerPhone || '---'}</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-gray-400 bg-[#0B1120]/50 p-4 rounded-xl border border-gray-800/50">
          <div className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> Multi-currency escrow vault secured</div>
          <div className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> Instant release to OPay, PalmPay, or Bank</div>
          <div className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> Automated compliance & dispute handling</div>
        </div>
      </div>
    </div>
  )
}
