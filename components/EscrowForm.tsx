'use client'
import React, { useState, useEffect } from 'react'
import { NIGERIAN_BANKS } from '@/lib/banks'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function EscrowForm({ setActiveView }: { setActiveView: (v: string) => void }) {
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  const [selectedBank, setSelectedBank] = useState(NIGERIAN_BANKS[0])
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [generatedLink, setGeneratedLink] = useState('')
  const [waLink, setWaLink] = useState('')

  // Live Bank Resolution
  useEffect(() => {
    if (accountNumber.length === 10) {
      setIsVerifying(true)
      setAccountName('')

      fetch('/api/paystack/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode: selectedBank.code })
      })
        .then((res) => res.json())
        .then((data) => {
          setIsVerifying(false)
          if (data.account_name) {
            setAccountName(data.account_name)
            toast.success(`Account Resolved: ${data.account_name}`)
          } else {
            toast.error(data.error || 'Account lookup failed')
          }
        })
        .catch(() => {
          setIsVerifying(false)
          toast.error('Failed to verify bank account')
        })
    } else {
      setAccountName('')
    }
  }, [accountNumber, selectedBank])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      toast.error('You must accept the Escrow Terms & Conditions.')
      return
    }

    if (!accountName) {
      toast.error('Please provide a valid verified bank account.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('escrow_deals')
        .insert({
          buyer_phone: buyerPhone,
          item_name: itemName,
          item_description: itemDesc,
          currency,
          price: Number(itemPrice),
          bank_name: selectedBank.name,
          bank_code: selectedBank.code,
          account_number: accountNumber,
          account_name: accountName,
          status: 'pending_payment'
        })
        .select()
        .single()

      if (error || !data) {
        toast.error(error?.message || 'Failed to save deal to database')
        setIsSubmitting(false)
        return
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fidulync.com'
      const url = `${origin}/pay/${data.id}`
      setGeneratedLink(url)

      const msg = `Hello! A safe FiduLync escrow deal has been created for "${itemName}".\nTotal Price: ${currency} ${itemPrice}\nPay securely here: ${url}`
      setWaLink(`https://wa.me/${buyerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`)
      toast.success('Escrow Deal Created Live!')
    } catch (err: any) {
      toast.error('Error creating deal')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {!generatedLink ? (
        <form onSubmit={handleGenerate} className="bg-[#111827] border border-gray-800 rounded-3xl p-5 sm:p-8 space-y-5 shadow-2xl">
          <div className="border-b border-gray-800 pb-3">
            <h2 className="text-xl font-black text-white">Create Safe Escrow Link</h2>
            <p className="text-xs text-gray-400 mt-0.5">Funds are held safely in vault until delivery is verified.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-gray-400">Buyer's Phone / WhatsApp *</label>
            <input required type="tel" placeholder="+2348000000000" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Item Name *</label>
              <input required type="text" placeholder="e.g. MQL5 Trading Expert Advisor" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Item Description</label>
              <input type="text" placeholder="License details or item specs..." value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-emerald-500">
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Price *</label>
              <input required type="number" placeholder="50000" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white font-mono font-bold outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-800 space-y-4">
            <h3 className="text-xs font-bold uppercase text-emerald-400">🏦 Seller Payout Settlement Account</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-gray-400">Select Bank</label>
                <select
                  value={selectedBank.code}
                  onChange={(e) => {
                    const b = NIGERIAN_BANKS.find((x) => x.code === e.target.value)
                    if (b) setSelectedBank(b)
                  }}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
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
              <span>I agree to the <button type="button" onClick={() => setActiveView('terms')} className="text-emerald-400 underline font-bold">Legal Terms & Escrow Protection Rules</button></span>
            </label>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20">
            {isSubmitting ? 'Creating Escrow Record...' : '🔒 Generate Live Buyer Link'}
          </button>
        </form>
      ) : (
        <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">✓</div>
          <h2 className="text-2xl font-black text-white">Live Payment Link Created</h2>
          <div className="bg-[#0B1120] p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono text-emerald-400">
            <span className="truncate">{generatedLink}</span>
            <button onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Link copied!'); }} className="bg-gray-800 text-white px-3 py-1.5 rounded font-sans font-bold hover:bg-gray-700">Copy</button>
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
