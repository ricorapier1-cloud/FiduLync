interface DealProps {
  itemName: string
  itemPrice: string
  buyerPhone: string
}

export default function DealSummary({ itemName, itemPrice, buyerPhone }: DealProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
        LIVE DEAL SUMMARY <span className="bg-[#111827] text-emerald-400 px-2 py-1 rounded text-[10px] border border-gray-800">Escrow Protected</span>
      </h3>
      
      <div className="bg-[#111827] p-6 rounded-3xl border border-gray-800 shadow-xl sticky top-24">
        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-1">Item</p>
          <p className="text-lg font-bold text-white break-words">{itemName || 'Item Name Placeholder'}</p>
        </div>
        
        <div className="flex justify-between items-end mb-6 bg-[#0B1120] p-4 rounded-xl border border-gray-800">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Amount</p>
            <p className="text-3xl font-black text-emerald-400">₦{Number(itemPrice).toLocaleString() || '0'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Buyer Phone</p>
            <p className="text-sm font-bold text-gray-300">{buyerPhone || 'Not entered'}</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-gray-400">
          <div className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> Funds held safely until delivery is confirmed</div>
          <div className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> Instant automated transfer to seller account</div>
          <div className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> 24/7 Dispute resolution via WhatsApp</div>
        </div>
      </div>
    </div>
  )
}
