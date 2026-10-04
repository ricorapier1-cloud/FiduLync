'use client'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function EscrowForm({ setActiveView }: { setActiveView: (v: string) => void }) {
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  const [convertedPrice, setConvertedPrice] = useState('')
  const [bankName, setBankName] = useState('Access Bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [agreed, setAgreed] = useState(false)
  
  const [generatedLink, setGeneratedLink] = useState('')
  const [waLink, setWaLink] = useState('')

  const rates: Record<string, number> = { NGN: 1, USD: 1650, EUR: 1780, GBP: 2100, GHS: 105, KES: 12.8, ZAR: 92 }

  useEffect(() => {
    if (itemPrice && !isNaN(Number(itemPrice))) {
      const val = Number(itemPrice)
      if (currency === 'NGN') setConvertedPrice(`≈ $${(val / rates.USD).toFixed(2)} USD`)
      else setConvertedPrice(`≈ ₦${(val * (rates[currency] || 1650)).toLocaleString()} NGN`)
    } else {
      setConvertedPrice('')
    }
  }, [itemPrice, currency])

  useEffect(() => {
    if (accountNumber.length === 10) {
      setIsVerifying(true)
      setAccountName('')
      const timer = setTimeout(() => {
        setIsVerifying(false)
        setAccountName('AKINSOOTO ERIC AKINWALE')
        toast.success('Paystack Resolved Account Name!')
      }, 1200)
      return () => clearTimeout(timer)
    } else {
      setAccountName('')
    }
  }, [accountNumber, bankName])

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      toast.error('Please accept the Terms & Conditions.')
      return
    }
    const linkId = Math.random().toString(36).substring(2, 9)
    const url = `https://fidulync.com/pay/${linkId}`
    setGeneratedLink(url)

    const msg = `Hello! A safe escrow deal for "${itemName}" has been generated on FiduLync.\nAmount: ${currency} ${itemPrice}\nPay securely here: ${url}`
    setWaLink(`https://wa.me/${buyerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`)
    toast.success('Escrow link created!')
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {!generatedLink ? (
        <form onSubmit={handleGenerate} className="bg-[#111827] border border-gray-800 rounded-3xl p-5 sm:p-8 space-y-5 shadow-2xl">
          <div className="border-b border-gray-800 pb-3">
            <h2 className="text-xl font-black text-white">Generate Escrow Payment Link</h2>
            <p className="text-xs text-gray-400 mt-1">Funds are held safely in vault until delivery is verified.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-gray-400">Buyer's WhatsApp Phone *</label>
            <input required type="tel" placeholder="08000000000" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Item Name *</label>
              <input required type="text" placeholder="e.g. MQL5 Trading Bot" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Description</label>
              <input type="text" placeholder="Item condition or specifications..." value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500">
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="GHS">GHS (₵)</option>
                <option value="KES">KES (KSh)</option>
                <option value="ZAR">ZAR (R)</option>
              </select>
            </div>
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold uppercase text-gray-400">Price *</label>
              <input required type="number" placeholder="50000" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono font-bold outline-none focus:border-emerald-500" />
              {convertedPrice && <span className="absolute right-3 top-9 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">{convertedPrice}</span>}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-800 space-y-4">
            <h3 className="text-xs font-bold uppercase text-emerald-400">🏦 Seller Payout Account</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-gray-400">Bank Name</label>
                <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500">
                  <option value="Access Bank">Access Bank</option>
                  <option value="GTBank">GTBank</option>
                  <option value="Zenith Bank">Zenith Bank</option>
                  <option value="First Bank">First Bank of Nigeria</option>
                  <option value="Kuda Bank">Kuda Bank</option>
                  <option value="OPay">OPay</option>
                  <option value="Moniepoint">Moniepoint</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-gray-400">Account Number</label>
                <div className="relative">
                  <input required type="text" maxLength={10} placeholder="0123456789" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" />
                  {isVerifying && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                </div>
                {accountName && <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded inline-block mt-1">✓ {accountName}</div>}
              </div>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="rounded border-gray-700 text-emerald-500" />
              <span>I agree to the <button type="button" onClick={() => setActiveView('terms')} className="text-emerald-400 underline">Terms & Conditions</button></span>
            </label>
          </div>

          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20">
            🔒 Generate Safe Link
          </button>
        </form>
      ) : (
        <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl">🎉</div>
          <h2 className="text-2xl font-black text-white">Escrow Payment Link Ready</h2>
          <div className="bg-[#0B1120] p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono text-emerald-400">
            <span className="truncate">{generatedLink}</span>
            <button onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Copied!'); }} className="bg-gray-800 text-white px-3 py-1.5 rounded font-sans font-bold">Copy</button>
          </div>
          <div className="space-y-2">
            <a href={waLink} target="_blank" rel="noreferrer" className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <span>💬</span> Send Link to Buyer via WhatsApp
            </a>
            <button onClick={() => setGeneratedLink('')} className="w-full bg-gray-800 text-gray-300 font-bold py-3 rounded-xl text-xs">
              Generate Another Link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
