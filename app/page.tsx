'use client'

import { useState } from 'react'
import { ShieldCheck, Copy, Share2, Plus, Lock, Loader2, Sparkles, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [role, setRole] = useState<'seller' | 'buyer'>('seller')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [feeBearer, setFeeBearer] = useState<'buyer' | 'seller' | 'split'>('buyer')
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null)

  const priceNum = parseFloat(itemPrice) || 0
  
  // 2.5% platform fee with a max cap of ₦5,000
  const rawFee = priceNum * 0.025
  const calculatedFee = Math.min(rawFee, 5000)

  let buyerFee = 0
  let sellerFee = 0

  if (feeBearer === 'buyer') {
    buyerFee = calculatedFee
  } else if (feeBearer === 'seller') {
    sellerFee = calculatedFee
  } else {
    buyerFee = calculatedFee / 2
    sellerFee = calculatedFee / 2
  }

  const totalPayable = priceNum + buyerFee
  const sellerPayout = priceNum - sellerFee

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const randomSlug = `vp_${Math.random().toString(36).substring(2, 9)}`
    const itemAmountKobo = Math.round(priceNum * 100)
    const platformFeeKobo = Math.round(calculatedFee * 100)
    const totalPayableKobo = Math.round(totalPayable * 100)

    const { error } = await supabase.from('escrows').insert([
    {
      slug: randomSlug,
      title: itemName,
      amount: priceNum,
      buyer_phone: buyerPhone,
      description: itemDescription,
      fee_bearer: feeBearer,
      status: 'pending_payment',
    }
  ])

    setLoading(false)
    if (error) {
      alert(`Error creating Safe Link: ${error.message}`)
    } else {
      setGeneratedSlug(randomSlug)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1A1A]">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="bg-[#006643] text-white p-2 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#006643]">VeriPay</span>
        </div>

        <div className="bg-gray-100 p-1 rounded-full flex items-center border border-gray-200">
          <button
            onClick={() => setRole('seller')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
              role === 'seller' ? 'bg-[#006643] text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            I am a Seller
          </button>
          <button
            onClick={() => setRole('buyer')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
              role === 'buyer' ? 'bg-[#006643] text-white shadow-sm' : 'text-gray-600'
            }`}
          >
            I am a Buyer
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {role === 'seller' ? (
          <>
            {/* Promo Banner */}
            <div className="bg-gradient-to-r from-emerald-800 to-[#006643] text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/10 p-2 rounded-xl">
                  <Sparkles className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Launch Special: 0% Escrow Fees</h3>
                  <p className="text-xs text-emerald-100">Your first 3 Safe Links are completely fee-free!</p>
                </div>
              </div>
              <span className="bg-emerald-400/20 text-emerald-200 text-xs px-2.5 py-1 rounded-full border border-emerald-400/30 font-mono">
                PROMO3 FREE
              </span>
            </div>

            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-gray-900">Seller Dashboard</h1>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-[#006643] px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                    <Award className="w-3 h-3" /> Verified Vendor
                  </span>
                </div>
                <p className="text-sm text-gray-500">Escrow Protection Active • ₦5,000 Max Fee Cap Active</p>
              </div>
              <button
                onClick={() => {
                  setGeneratedSlug(null)
                  setIsModalOpen(true)
                }}
                className="bg-[#006643] hover:bg-[#004d32] text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center space-x-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Safe Link</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800">Recent Transactions</h2>
              <div className="text-center py-8 text-gray-400 text-sm">
                No active safe links yet. Click "+ Create Safe Link" above to start.
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-4 shadow-sm">
            <ShieldCheck className="w-12 h-12 text-[#006643] mx-auto" />
            <h2 className="text-xl font-bold">Buyer Portal</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              To pay for an item, open the custom VeriPay Safe Link sent by your seller via WhatsApp or Instagram DM.
            </p>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-900">Create New Safe Link</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {!generatedSlug ? (
              <form onSubmit={handleCreateLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Buyer's WhatsApp Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 08012345678"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#006643] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. iPhone 14 Pro Max"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#006643] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item Description</label>
                  <textarea
                    required
                    placeholder="256GB, Deep Purple, Factory Unlocked"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#006643] outline-none h-20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Item Price (₦)</label>
                  <input
                    type="number"
                    required
                    placeholder="650000"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#006643] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Who Pays VeriPay Escrow Fee?</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFeeBearer('buyer')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                        feeBearer === 'buyer'
                          ? 'bg-[#006643] text-white border-[#006643]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Buyer Pays
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeeBearer('split')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                        feeBearer === 'split'
                          ? 'bg-[#006643] text-white border-[#006643]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Split 50/50
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeeBearer('seller')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                        feeBearer === 'seller'
                          ? 'bg-[#006643] text-white border-[#006643]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Seller Pays
                    </button>
                  </div>
                </div>

                {priceNum > 0 && (
                  <div className="bg-[#F8FAFC] p-3 rounded-xl border border-gray-200 text-xs space-y-1.5">
                    <div className="flex justify-between text-gray-600">
                      <span>Item Price:</span>
                      <span>₦{priceNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Total Escrow Fee (2.5% max ₦5k):</span>
                      <span>₦{calculatedFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#006643] pt-1 border-t">
                      <span>Total Buyer Pays:</span>
                      <span>₦{totalPayable.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Seller Payout after fee:</span>
                      <span>₦{sellerPayout.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#006643] text-white py-3 rounded-xl font-semibold text-sm shadow-sm hover:bg-[#004d32] transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Generate Safe Link</span>}
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-[#006643] rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-gray-900">VeriPay Safe Link Created!</h4>
                <div className="bg-gray-100 p-3 rounded-xl break-all text-xs text-gray-700 font-mono">
                  {`${window.location.origin}/pay/${generatedSlug}`}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pay/${generatedSlug}`)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center space-x-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </button>
                  <a
                    href={`https://wa.me/${buyerPhone}?text=${encodeURIComponent(
                      `Hi! Here is your official VeriPay Escrow Safe Link for ${itemName} (₦${totalPayable.toLocaleString()}): ${window.location.origin}/pay/${generatedSlug}\n\nYour payment will be held safely in escrow until you receive and inspect your item!`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-medium text-xs flex items-center justify-center space-x-1"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
