'use client'
import { useState } from 'react'
import EscrowForm from './EscrowForm'
import DealSummary from './DealSummary'

export default function EscrowGenerator() {
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [currency, setCurrency] = useState('NGN')

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center">
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 shadow-sm">
          <div className="text-emerald-400 font-black text-xl mb-1">100%</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Scam Protection</div>
        </div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 shadow-sm">
          <div className="text-white font-black text-xl mb-1">&lt; 2 Mins</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Global Payouts</div>
        </div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 shadow-sm">
          <div className="text-white font-black text-xl mb-1">Multi</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Currencies</div>
        </div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 shadow-sm">
          <div className="text-[#0ea5e9] font-black text-xl mb-1">PAYSTACK</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Secured Gateway</div>
        </div>
      </div>

      <div className="mb-10 text-center md:text-left">
        <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 mb-4 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          ✨ Global Social Commerce Blueprint
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">Create a <span className="text-emerald-400">Strategic Payment Link</span></h1>
        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto md:mx-0">
          Lock buyer funds securely across multiple currencies. Payouts route directly to local banks, OPay, or PalmPay instantly upon delivery confirmation.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        <div className="md:col-span-3 bg-[#111827] p-6 rounded-3xl border border-gray-800 shadow-2xl">
          <EscrowForm 
            buyerPhone={buyerPhone} setBuyerPhone={setBuyerPhone}
            itemName={itemName} setItemName={setItemName}
            itemPrice={itemPrice} setItemPrice={setItemPrice}
            currency={currency} setCurrency={setCurrency}
          />
        </div>
        <div className="md:col-span-2">
          <DealSummary itemName={itemName} itemPrice={itemPrice} buyerPhone={buyerPhone} currency={currency} />
        </div>
      </div>
    </div>
  )
}
