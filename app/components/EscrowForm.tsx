'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function EscrowForm() {
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  
  const [bankName, setBankName] = useState('Access Bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName || !itemPrice || !accountNumber) {
      toast.error('Please fill in all required fields.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: itemName,
          description: itemDescription,
          amount: Number(itemPrice),
          currency,
          buyer_phone: buyerPhone,
          seller_phone: sellerPhone,
          seller_account_name: 'Verified Seller',
          seller_account_number: accountNumber,
          seller_bank_code: bankName,
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create escrow link')

      const link = `${window.location.origin}/pay/${data.link_id}`
      setGeneratedLink(link)
      toast.success('Safe Payment Link Generated!')

      if (buyerPhone || sellerPhone) {
        await fetch('/api/whatsapp/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: buyerPhone || sellerPhone,
            recipient_name: 'Valued Client',
            item_title: itemName,
            amount: itemPrice,
            currency,
            link_url: link
          })
        }).catch(() => {})
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formattedAmount = itemPrice ? Number(itemPrice).toLocaleString() : '0'

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {generatedLink ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4">
          <div className="text-emerald-400 font-bold text-base">✨ Safe Payment Link Ready!</div>
          <input 
            type="text" 
            readOnly 
            value={generatedLink} 
            className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-xs text-white text-center font-mono select-all"
          />
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Copied link!') }}
              className="bg-emerald-500 text-black font-extrabold text-xs px-6 py-3 rounded-xl hover:bg-emerald-400 transition"
            >
              Copy Link
            </button>
            <button 
              onClick={() => setGeneratedLink('')}
              className="bg-gray-800 text-gray-300 font-bold text-xs px-6 py-3 rounded-xl hover:bg-gray-700 transition"
            >
              Create New
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="bg-[#111827] border border-gray-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Buyer Phone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
              BUYER'S WHATSAPP PHONE *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500 text-sm">📱</span>
              <input 
                type="text" 
                placeholder="e.g. 08000000000"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full bg-[#0B1120] border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
              ITEM NAME *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500 text-sm">📦</span>
              <input 
                type="text" 
                placeholder="e.g. iPhone 14 Pro Max"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                className="w-full bg-[#0B1120] border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Item Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
              ITEM DESCRIPTION
            </label>
            <textarea 
              rows={3}
              placeholder="e.g. Brand new, 256GB Deep Purple, original box included..."
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition resize-none"
            />
          </div>

          {/* Currency & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                CURRENCY
              </label>
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                ITEM PRICE *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-emerald-400 font-bold text-sm">₦</span>
                <input 
                  type="number" 
                  placeholder="650000"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  required
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Seller Payout Account Header */}
          <div className="border-t border-gray-800/80 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">🏦</span>
                <span className="text-xs font-bold uppercase tracking-wider text-white">SELLER PAYOUT ACCOUNT</span>
              </div>
              <span className="text-[10px] text-gray-400">Where seller gets paid</span>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Bank Name</label>
              <select 
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="Access Bank">Access Bank</option>
                <option value="GTBank">Guaranty Trust Bank (GTBank)</option>
                <option value="First Bank">First Bank of Nigeria</option>
                <option value="UBA">United Bank for Africa (UBA)</option>
                <option value="Zenith Bank">Zenith Bank</option>
                <option value="OPay">OPay Digital Services</option>
                <option value="PalmPay">PalmPay</option>
                <option value="Kuda Bank">Kuda Microfinance Bank</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Account Number (10 Digits)</label>
                <input 
                  type="text" 
                  placeholder="0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Seller WhatsApp Phone</label>
                <input 
                  type="text" 
                  placeholder="e.g. 08000000000"
                  value={sellerPhone}
                  onChange={(e) => setSellerPhone(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 rounded-xl transition shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
          >
            <span>🔒</span> {loading ? 'Generating Safe Link...' : 'Generate Safe Link'}
          </button>
        </form>
      )}

      {/* Reactive Live Deal Summary Card matching Video */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-800/80 pb-4">
          <span className="text-xs font-extrabold uppercase tracking-widest text-gray-400">
            LIVE DEAL SUMMARY
          </span>
          <span className="text-[10px] font-mono font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30">
            Escrow Protected
          </span>
        </div>

        <div>
          <div className="text-[10px] font-mono uppercase text-gray-500">ITEM</div>
          <div className="text-lg font-black text-white mt-0.5">
            {itemName || 'Item Name Placeholder'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-[#0B1120] p-4 rounded-2xl border border-gray-800/80">
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500">Total Amount</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              ₦{formattedAmount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-gray-500">Buyer Phone</div>
            <div className="text-xs font-mono text-gray-300 mt-1">
              {buyerPhone || 'Not entered'}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-sm">✓</span>
            <span>Funds held safely until delivery is confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-sm">✓</span>
            <span>Instant automated transfer to seller account</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-sm">✓</span>
            <span>24/7 Dispute resolution via WhatsApp</span>
          </div>
        </div>
      </div>
    </div>
  )
}
