'use client'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function FidulyncApp() {
  // Navigation & History State
  const [activeView, setActiveView] = useState<'home' | 'store' | 'dashboard' | 'disputes' | 'terms'>('home')
  const [history, setHistory] = useState<string[]>(['home'])

  const navigateTo = (view: any) => {
    setHistory(prev => [...prev, view])
    setActiveView(view)
  }

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history]
      newHistory.pop() // remove current
      const prevView = newHistory[newHistory.length - 1]
      setHistory(newHistory)
      setActiveView(prevView as any)
    }
  }
  
  // Escrow Form State
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  const [convertedPrice, setConvertedPrice] = useState('')
  const [bankName, setBankName] = useState('044') // Default Access Bank Code
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isVerifyingBank, setIsVerifyingBank] = useState(false)
  const [sellerPhone, setSellerPhone] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  // Post-Creation State
  const [generatedLink, setGeneratedLink] = useState('')
  const [waShareLink, setWaShareLink] = useState('')

  // AlgoLync Modal State
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [modalType, setModalType] = useState<'buy' | 'demo' | null>(null)
  const [modalEmail, setModalEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')

  const supportWhatsAppNumber = '2348000000000' // REPLACE WITH YOUR NUMBER

  // Exchange Rates Mock (In production, fetch from API)
  const exchangeRates: Record<string, number> = {
    NGN: 1,
    USD: 1650,
    EUR: 1780,
    GBP: 2100
  }

  // Auto Currency Converter Effect
  useEffect(() => {
    if (itemPrice && !isNaN(Number(itemPrice))) {
      const baseValue = Number(itemPrice)
      if (currency === 'NGN') {
        setConvertedPrice(`≈ $${(baseValue / exchangeRates.USD).toFixed(2)} USD`)
      } else if (currency === 'USD') {
        setConvertedPrice(`≈ ₦${(baseValue * exchangeRates.USD).toLocaleString()} NGN`)
      } else if (currency === 'EUR') {
        setConvertedPrice(`≈ ₦${(baseValue * exchangeRates.EUR).toLocaleString()} NGN`)
      } else if (currency === 'GBP') {
        setConvertedPrice(`≈ ₦${(baseValue * exchangeRates.GBP).toLocaleString()} NGN`)
      }
    } else {
      setConvertedPrice('')
    }
  }, [itemPrice, currency])

  // Auto Bank Resolution Mock Effect
  useEffect(() => {
    if (accountNumber.length === 10) {
      setIsVerifyingBank(true)
      setAccountName('')
      // Simulate Paystack API Call delay
      const timer = setTimeout(() => {
        setIsVerifyingBank(false)
        setAccountName('AKINSOOTO ERIC AKINWALE') // Mock verified name
        toast.success('Bank Account Verified!')
      }, 1500)
      return () => clearTimeout(timer)
    } else {
      setAccountName('')
    }
  }, [accountNumber, bankName])

  const menus = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'disputes', label: 'Disputes', icon: '⚖️' },
    { id: 'terms', label: 'Terms', icon: '📜' },
    { id: 'store', label: 'Store', icon: '🤖' }
  ]

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) {
      toast.error('You must agree to the Terms & Conditions.')
      return
    }
    if (!accountName) {
      toast.error('Please wait for bank account verification.')
      return
    }

    // Generate Mock Link
    const linkId = Math.random().toString(36).substring(2, 10)
    const link = `https://fidulync.com/pay/${linkId}`
    setGeneratedLink(link)

    // Generate WhatsApp Share Link
    const message = `Hello! I've created a secured escrow link for "${itemName}" via FiduLync. \n\nAmount: ${currency === 'NGN'?'₦':'$'}${itemPrice}\n\nPay safely here (Funds are protected): ${link}`
    const encodedMessage = encodeURIComponent(message)
    const formattedPhone = buyerPhone.replace(/\D/g, '')
    setWaShareLink(`https://wa.me/${formattedPhone}?text=${encodedMessage}`)
    
    toast.success('Safe Escrow Link Generated Successfully!')
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink)
    toast.success('Link copied to clipboard!')
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white pb-24 font-sans selection:bg-emerald-500/30 relative">
      
      {/* Floating Support Button */}
      <a 
        href={`https://wa.me/${supportWhatsAppNumber}?text=Hello FiduLync Support, I need help with...`}
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#1DA851] text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,211,102,0.4)] transition-transform hover:scale-110 flex items-center justify-center"
      >
        <span className="text-2xl">💬</span>
      </a>

      {/* Header & Navigation */}
      <nav className="border-b border-gray-800/80 bg-[#0B1120]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateTo('home')}>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-base shrink-0">🛡️</div>
            <div>
              <div className="text-lg font-black tracking-tight leading-none text-white">FiduLync</div>
              <div className="text-[9px] text-emerald-400 font-mono font-bold tracking-widest mt-0.5">SAFE ESCROW</div>
            </div>
          </div>
        </div>

        {/* Smaller Front Page Menus with Back Button */}
        <div className="max-w-4xl mx-auto px-4 pb-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {history.length > 1 && (
            <button 
              onClick={goBack}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 shrink-0 transition-colors"
            >
              ←
            </button>
          )}
          {menus.map((menu) => (
            <button 
              key={menu.id}
              onClick={() => navigateTo(menu.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                activeView === menu.id 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm' 
                  : 'bg-[#111827] border border-gray-800/60 text-gray-400 hover:bg-[#1A2332] hover:text-white'
              }`}
            >
              <span>{menu.icon}</span>
              {menu.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Router */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        
        {/* ================= DASHBOARD VIEW ================= */}
        {activeView === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black">Transaction Dashboard</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
                <div className="text-xs text-gray-400">Active Deals</div>
                <div className="text-2xl font-black text-emerald-400">3</div>
              </div>
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
                <div className="text-xs text-gray-400">Completed</div>
                <div className="text-2xl font-black text-white">12</div>
              </div>
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
                <div className="text-xs text-gray-400">In Dispute</div>
                <div className="text-2xl font-black text-red-400">0</div>
              </div>
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
                <div className="text-xs text-gray-400">Total Volume</div>
                <div className="text-2xl font-black text-white">₦1.4M</div>
              </div>
            </div>

            <div className="bg-[#111827] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800"><h3 className="font-bold text-sm">Recent Transactions</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="bg-[#0B1120] text-xs uppercase font-bold text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr className="hover:bg-gray-800/30">
                      <td className="px-4 py-4 text-white font-medium">MacBook Pro M2</td>
                      <td className="px-4 py-4 font-mono">₦1,200,000</td>
                      <td className="px-4 py-4"><span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs">Awaiting Delivery</span></td>
                      <td className="px-4 py-4">Oct 3, 2026</td>
                    </tr>
                    <tr className="hover:bg-gray-800/30">
                      <td className="px-4 py-4 text-white font-medium">Eridam Nexus Pro</td>
                      <td className="px-4 py-4 font-mono">$49.00</td>
                      <td className="px-4 py-4"><span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs">Completed</span></td>
                      <td className="px-4 py-4">Oct 1, 2026</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TERMS AND CONDITIONS VIEW ================= */}
        {activeView === 'terms' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
            <h2 className="text-2xl font-black border-b border-gray-800 pb-4">Terms & Conditions of Escrow</h2>
            <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
              <section className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-base">1. The Escrow Process</h3>
                <p>FiduLync acts as a neutral third-party holding facility. Funds are securely deducted from the Buyer and held in an encrypted vault. Funds are ONLY released to the Seller when the Buyer explicitly confirms receipt of the goods/services, or after the automated inspection period expires without a dispute.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-base">2. Prohibited Transactions</h3>
                <p>Users are strictly prohibited from using FiduLync for:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                  <li>Illegal drugs, narcotics, or unregulated supplements.</li>
                  <li>Weapons, firearms, or explosive materials.</li>
                  <li>Fraudulent services, money laundering, or pyramid schemes.</li>
                  <li>Any digital goods that violate copyright laws.</li>
                </ul>
              </section>
              <section className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-base">3. Dispute Resolution Protocol</h3>
                <p>If a Buyer rejects the delivery, the transaction enters the AI Resolution Center. The Seller must provide undeniable Proof of Delivery (tracking numbers, dispatch receipts, or digital access logs). FiduLync’s arbitration team reserves the final right to disburse funds based on the evidence provided.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-base">4. Platform Fees</h3>
                <p>A standard platform maintenance and processing fee of 2% is applied to all successful transactions. In the event of a refunded dispute, the original payment gateway processing fees are non-refundable.</p>
              </section>
            </div>
          </div>
        )}

        {/* ================= HOME / ESCROW FORM VIEW ================= */}
        {activeView === 'home' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {!generatedLink ? (
              <>
                <div className="text-center space-y-2">
                  <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Create Safe Payment Link</h1>
                  <p className="text-xs sm:text-sm text-gray-400">Lock buyer funds in escrow. Instant bank payout upon delivery.</p>
                </div>

                <form onSubmit={handleCreateDeal} className="bg-[#111827] border border-gray-800/80 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl">
                  
                  <div className="space-y-2">
                    <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Buyer's WhatsApp Phone *</label>
                    <input 
                      required type="tel" placeholder="e.g. 08000000000" 
                      value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Item Name *</label>
                      <input 
                        required type="text" placeholder="e.g. iPhone 14 Pro Max" 
                        value={itemName} onChange={(e) => setItemName(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Item Description</label>
                      <input 
                        type="text" placeholder="Brief details..." 
                        value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Currency</label>
                      <select 
                        value={currency} onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm font-bold focus:border-emerald-500 outline-none"
                      >
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Item Price *</label>
                      <input 
                        required type="number" placeholder="0.00" 
                        value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm font-bold font-mono focus:border-emerald-500 outline-none"
                      />
                      {convertedPrice && (
                        <div className="absolute right-3 top-9 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          {convertedPrice}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seller Payout Section with Auto-Resolution */}
                  <div className="pt-4 border-t border-gray-800 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                        <span>🏦</span> Seller Payout Account
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Bank Name</label>
                        <select 
                          value={bankName} onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm focus:border-emerald-500 outline-none"
                        >
                          <option value="044">Access Bank</option>
                          <option value="011">First Bank of Nigeria</option>
                          <option value="058">GTBank</option>
                          <option value="057">Zenith Bank</option>
                          <option value="033">UBA</option>
                          <option value="50211">Kuda Bank</option>
                          <option value="100004">OPay</option>
                          <option value="100033">PalmPay</option>
                          <option value="50515">Moniepoint</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Account Number (10 Digits)</label>
                        <div className="relative">
                          <input 
                            required type="text" maxLength={10} placeholder="0123456789" 
                            value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-white text-sm font-mono focus:border-emerald-500 outline-none"
                          />
                          {isVerifyingBank && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                        </div>
                        {accountName && <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 inline-block px-2 py-1 rounded">✓ {accountName}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded bg-[#0B1120] border-gray-700 text-emerald-500" 
                      />
                      <span className="text-xs text-gray-400 leading-snug">
                        I agree to the <span className="text-emerald-400 hover:underline" onClick={(e) => { e.preventDefault(); navigateTo('terms'); }}>Terms & Conditions</span>.
                      </span>
                    </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={accountNumber.length === 10 && !accountName && !isVerifyingBank}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔒 Generate Safe Link
                  </button>
                </form>
              </>
            ) : (
              /* SUCCESS STATE: LINK GENERATED */
              <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">🎉</div>
                <div>
                  <h2 className="text-2xl font-black text-white">Link Generated!</h2>
                  <p className="text-sm text-gray-400 mt-1">Share this link with your buyer to secure the payment.</p>
                </div>
                
                <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800 flex items-center justify-between gap-3">
                  <div className="text-emerald-400 font-mono text-sm truncate select-all">{generatedLink}</div>
                  <button onClick={copyToClipboard} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                    COPY
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <a 
                    href={waShareLink} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <span>💬</span> Send to Buyer via WhatsApp
                  </a>
                  <button onClick={() => setGeneratedLink('')} className="w-full bg-transparent border border-gray-700 hover:bg-gray-800 text-gray-300 font-bold py-3.5 rounded-xl transition text-sm">
                    Create Another Link
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= ALGOLYNC STORE VIEW ================= */}
        {activeView === 'store' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">AlgoLync Quant Suite</h1>
              <p className="text-sm text-gray-400 mt-2">Institutional-grade MetaTrader 5 tools.</p>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-5">
              <h2 className="text-xl font-black text-white">ERIDAM NEXUS ADAPTIVE PRO</h2>
              <div className="text-2xl font-black text-emerald-400">$49 <span className="text-sm text-gray-400">USD</span></div>
              <button 
                onClick={() => { setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', price: '49' }); setModalType('buy'); }}
                className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl transition"
              >
                Buy License
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Store Modal */}
      {modalType && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-5 relative">
            <button onClick={() => setModalType(null)} className="absolute top-4 right-4 text-gray-400 text-xl">✕</button>
            <h3 className="text-xl font-black text-white">Checkout: {selectedProduct?.name}</h3>
            <button onClick={() => setModalType(null)} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl">
              Pay ${selectedProduct?.price} USD
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
