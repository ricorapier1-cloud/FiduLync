'use client'
import { useState } from 'react'
import EscrowForm from './EscrowForm'
import DealSummary from './DealSummary'

export default function EscrowGenerator() {
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center">
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
          <div className="text-emerald-400 font-black text-xl mb-1">100%</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Scam Protection</div>
        </div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
          <div className="text-white font-black text-xl mb-1">&lt; 2 Mins</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Average Bank Payout</div>
        </div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
          <div className="text-white font-black text-xl mb-1">2%</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Platform Fee</div>
        </div>
        <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
          <div className="text-[#0ea5e9] font-black text-xl mb-1">PAYSTACK</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase">Secured Gateway</div>
        </div>
      </div>

      <div className="mb-10">
        <span className="inline-block bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20 mb-4">
          ✨ Zero Risk Social Commerce
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">Create a <span className="text-emerald-400">Safe Payment Link</span></h1>
        <p className="text-gray-400 text-sm md:text-base max-w-2xl">Lock buyer funds securely in escrow. Funds are automatically transferred to the seller's bank account once delivery is confirmed.</p>
      </div>

      <div className="flex justify-between items-center text-center text-xs text-gray-500 mb-8 max-w-2xl">
        <div>
          <div className="text-emerald-400 font-bold mb-1">1. Generate</div>
          <div>Create & send link</div>
        </div>
        <div className="flex-1 border-t border-gray-800 mx-4"></div>
        <div>
          <div className="text-white font-bold mb-1">2. Buyer Pays</div>
          <div>Money locked safely</div>
        </div>
        <div className="flex-1 border-t border-gray-800 mx-4"></div>
        <div>
          <div className="text-white font-bold mb-1">3. Release</div>
          <div>Instant bank payout</div>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        <div className="md:col-span-3 bg-[#111827] p-6 rounded-3xl border border-gray-800 shadow-2xl">
          <EscrowForm 
            buyerPhone={buyerPhone} setBuyerPhone={setBuyerPhone}
            itemName={itemName} setItemName={setItemName}
            itemPrice={itemPrice} setItemPrice={setItemPrice}
          />
        </div>
        <div className="md:col-span-2">
          <DealSummary itemName={itemName} itemPrice={itemPrice} buyerPhone={buyerPhone} />
        </div>
      </div>
    </div>
  )
}
