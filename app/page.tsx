'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function FidulyncApp() {
  // Navigation State
  const [activeView, setActiveView] = useState<'home' | 'store' | 'dashboard' | 'disputes' | 'terms'>('home')
  
  // Escrow Form State
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  const [bankName, setBankName] = useState('Access Bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // AlgoLync Modal State
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [modalType, setModalType] = useState<'buy' | 'demo' | null>(null)
  const [modalEmail, setModalEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')

  const menus = [
    { id: 'dashboard', label: 'Command Center', icon: '📊' },
    { id: 'disputes', label: 'AI Resolution Center', icon: '⚖️' },
    { id: 'terms', label: 'Legal & Terms', icon: '📜' },
    { id: 'store', label: 'AlgoLync Store', icon: '🤖' }
  ]

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) {
      toast.error('You must agree to the Terms & Conditions before creating a link.')
      return
    }
    if (!accountNumber || accountNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit account number.')
      return
    }
    toast.success('Safe Escrow Link Generated Successfully!')
  }

  const handleStoreCheckout = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success(`Redirecting to Paystack for ${selectedProduct?.name}...`)
    setModalType(null)
  }

  const handleDemoDownload = () => {
    toast.success(`Downloading demo trial for ${selectedProduct?.name} (.ex5)...`)
    setModalType(null)
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white pb-24 font-sans selection:bg-emerald-500/30">
      
      {/* Header & Navigation */}
      <nav className="border-b border-gray-800/80 bg-[#0B1120]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          {/* Logo - Clicking it returns to the Escrow Home */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('home')}>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shrink-0">🛡️</div>
            <div>
              <div className="text-xl font-black tracking-tight leading-none text-white">FiduLync</div>
              <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                SAFE ESCROW PROTECTION
              </div>
            </div>
          </div>
        </div>

        {/* Front Page Menus */}
        <div className="max-w-4xl mx-auto px-4 pb-2 overflow-x-auto hide-scrollbar flex gap-2 sm:gap-4">
          {menus.map((menu) => (
            <button 
              key={menu.id}
              onClick={() => setActiveView(menu.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                activeView === menu.id 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/5' 
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
        
        {activeView === 'home' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Trust Metrics Grid based on video layout */}
            <div className="grid grid-cols-2 gap-3 bg-[#111827]/60 border border-gray-800/80 rounded-2xl p-4 text-center">
              <div className="p-2 border-b border-r border-gray-800/80">
                <div className="text-xl sm:text-2xl font-black text-emerald-400">100%</div>
                <div className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">Scam Protection</div>
              </div>
              <div className="p-2 border-b border-gray-800/80">
                <div className="text-xl sm:text-2xl font-black text-white">&lt; 2 Mins</div>
                <div className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">Average Bank Payout</div>
              </div>
              <div className="p-2 border-r border-gray-800/80">
                <div className="text-xl sm:text-2xl font-black text-white">2%</div>
                <div className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">Platform Fee</div>
              </div>
              <div className="p-2 flex flex-col justify-center items-center">
                <div className="text-xl sm:text-2xl font-black text-white">PAYSTACK</div>
                <div className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider mt-0.5">Secured Gateway</div>
              </div>
            </div>

            {/* Header Banner */}
            <div className="space-y-3 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold px-3.5 py-1.5 rounded-full">
                <span>⚡</span> Zero Risk Social Commerce
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Create a Safe Payment Link</h1>
              <p className="text-sm text-gray-400 max-w-xl">
                Lock buyer funds securely in escrow. Funds are automatically transferred to the seller's bank account once delivery is confirmed.
              </p>
            </div>

            {/* 3-Step Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium">
              <div className="bg-[#111827]/40 border border-gray-800/60 rounded-2xl p-4 space-y-1">
                <span className="text-emerald-400 font-mono font-bold text-sm">1. Generate</span>
                <p className="text-gray-400">Create & send link</p>
              </div>
              <div className="bg-[#111827]/40 border border-gray-800/60 rounded-2xl p-4 space-y-1">
                <span className="text-emerald-400 font-mono font-bold text-sm">2. Buyer Pays</span>
                <p className="text-gray-400">Money locked safely</p>
              </div>
              <div className="bg-[#111827]/40 border border-gray-800/60 rounded-2xl p-4 space-y-1">
                <span className="text-emerald-400 font-mono font-bold text-sm">3. Release</span>
                <p className="text-gray-400">Instant bank payout</p>
              </div>
            </div>

            {/* Escrow Creation Form */}
            <form onSubmit={handleCreateDeal} className="bg-[#111827] border border-gray-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Buyer's WhatsApp Phone *</label>
                <input 
                  required 
                  type="tel" 
                  placeholder="e.g. 08000000000" 
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 transition outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Item Name *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. iPhone 14 Pro Max" 
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 transition outline-none font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Item Description</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Brand new, 256GB Deep Purple..." 
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 transition outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Currency</label>
                  <select 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-bold focus:border-emerald-500 transition outline-none"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Item Price *</label>
                  <input 
                    required 
                    type="number" 
                    placeholder="650000" 
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-bold font-mono focus:border-emerald-500 transition outline-none"
                  />
                </div>
              </div>

              {/* Seller Payout Section */}
              <div className="pt-4 border-t border-gray-800 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-sm">🏦</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Seller Payout Account</h3>
                    <p className="text-[11px] text-gray-400">Where seller gets paid</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Bank Name</label>
                    <select 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-medium focus:border-emerald-500 transition outline-none"
                    >
                      <option value="Access Bank">Access Bank</option>
                      <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                      <option value="GTBank (Guaranty Trust)">GTBank (Guaranty Trust)</option>
                      <option value="Zenith Bank">Zenith Bank</option>
                      <option value="UBA (United Bank for Africa)">UBA (United Bank for Africa)</option>
                      <option value="Kuda Bank">Kuda Bank</option>
                      <option value="OPay">OPay</option>
                      <option value="PalmPay">PalmPay</option>
                      <option value="Moniepoint">Moniepoint</option>
                      <option value="Stanbic IBTC">Stanbic IBTC</option>
                      <option value="Sterling Bank">Sterling Bank</option>
                      <option value="Wema Bank / ALAT">Wema Bank / ALAT</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Account Number (10 Digits)</label>
                    <input 
                      required 
                      type="text" 
                      maxLength={10}
                      placeholder="0123456789" 
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-mono focus:border-emerald-500 transition outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Seller WhatsApp Phone</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. 08000000000" 
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 transition outline-none font-mono"
                  />
                </div>
              </div>

              {/* T&C Checkbox Before Link Creation */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded bg-[#0B1120] border-gray-700 text-emerald-500 focus:ring-emerald-500" 
                  />
                  <span className="text-xs text-gray-400 leading-snug">
                    I agree to the <span className="text-emerald-400 hover:underline" onClick={(e) => { e.preventDefault(); setActiveView('terms'); }}>Terms & Conditions</span> and confirm that my information is accurate.
                  </span>
                </label>
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm tracking-wide flex items-center justify-center gap-2"
              >
                🔒 Generate Safe Link
              </button>
            </form>

            {/* Live Deal Summary Card */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Live Deal Summary</span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">
                  Escrow Protected
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Item Name</span>
                  <div className="text-sm font-bold text-white">{itemName || 'Item Name Placeholder'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Total Amount</span>
                    <div className="text-lg font-mono font-black text-emerald-400">
                      {currency === 'NGN' ? '₦' : '$'}{itemPrice ? Number(itemPrice).toLocaleString() : '0'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Buyer Phone</span>
                    <div className="text-sm font-mono text-gray-300">{buyerPhone || 'Not entered'}</div>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-800/80 space-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-2"><span className="text-emerald-400">✔</span> Funds held safely until delivery is confirmed</div>
                <div className="flex items-center gap-2"><span className="text-emerald-400">✔</span> Instant automated transfer to seller account</div>
                <div className="flex items-center gap-2"><span className="text-emerald-400">✔</span> 24/7 Dispute resolution via WhatsApp</div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ALGOLYNC QUANT SUITE STORE ================= */}
        {activeView === 'store' && (
          <div className="space-y-10 animate-in fade-in duration-300 pt-4">
            
            <div className="space-y-3 text-center flex flex-col items-center">
              <div className="text-emerald-400 text-[10px] font-bold tracking-[0.2em] uppercase">
                Algolync Quant Suite
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">MQL5 Trading <br/> Systems</h1>
              <p className="text-sm text-gray-400 max-w-sm mx-auto mt-2">
                Institutional-grade MetaTrader 5 tools with automated instant delivery.
              </p>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-4 text-xs font-semibold text-gray-300">
              <span className="flex items-center gap-1.5"><span className="text-amber-400 text-sm">🔒</span> 256-Bit SSL Encrypted</span>
              <span className="text-gray-600 font-black mb-1">.</span>
              <span className="flex items-center gap-1.5"><span className="text-amber-400 text-sm">🛡️</span> Secured by Paystack</span>
              <span className="text-gray-600 font-black mb-1">.</span>
              <span className="flex items-center gap-1.5"><span className="text-amber-400 text-sm">⚡</span> Instant File Delivery</span>
            </div>

            {/* Product Cards List */}
            <div className="space-y-6">
              
              {/* Product 1: Eridam Nexus */}
              <div className="bg-[#111827] border border-gray-800 rounded-[1.5rem] p-6 sm:p-8 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="bg-emerald-500/10 text-emerald-400 text-[11px] font-medium px-3 py-1 rounded-full">
                    Flagship EA
                  </div>
                  <div className="text-xs font-mono text-gray-500">v2.4</div>
                </div>
                
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight leading-snug">
                    ERIDAM NEXUS ADAPTIVE <br/> PRO
                  </h2>
                  <p className="text-sm text-gray-400 mt-3 leading-relaxed pr-4">
                    Quantitative MT5 EA featuring Kaufman Efficiency Ratio filtering, dynamic ATR envelopes, and high-watermark equity shield.
                  </p>
                </div>

                <div className="bg-[#0B1120] rounded-2xl p-4 grid grid-cols-2 gap-y-4">
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Historical Win Rate</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">74.2%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Profit Factor</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">2.14</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Max Drawdown</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">8.6%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Avg Monthly ROI</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">+12.4%</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-800/80">
                  <div className="text-xs text-gray-400 mb-1">Single Account License</div>
                  <div className="text-2xl font-black text-emerald-400 mb-4">$49 <span className="text-[11px] font-normal text-gray-400">USD</span></div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', price: '49' }); setModalType('demo'); }}
                      className="flex-1 bg-[#1F2937] hover:bg-gray-700 text-white font-medium py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
                    >
                      <span className="text-blue-400 text-lg">📥</span> Try Demo
                    </button>
                    <button 
                      onClick={() => { setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', price: '49' }); setModalType('buy'); }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-sm transition"
                    >
                      Buy License
                    </button>
                  </div>
                </div>
              </div>

              {/* Product 2: Z-Score Volatility Indicator */}
              <div className="bg-[#111827] border border-gray-800 rounded-[1.5rem] p-6 sm:p-8 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="bg-emerald-500/10 text-emerald-400 text-[11px] font-medium px-3 py-1 rounded-full">
                    Popular Indicator
                  </div>
                  <div className="text-xs font-mono text-gray-500">v1.1</div>
                </div>
                
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight leading-snug">
                    Z-Score Volatility Envelope <br/> Indicator
                  </h2>
                  <p className="text-sm text-gray-400 mt-3 leading-relaxed pr-4">
                    Custom MT5 indicator mapping real-time standard deviation breakouts with adaptive ALMA moving average filters.
                  </p>
                </div>

                <div className="bg-[#0B1120] rounded-2xl p-4 grid grid-cols-2 gap-y-4">
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Signal Accuracy</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">81.0%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Timeframes</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">M15 - H4</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Alert Types</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">Push & Sound</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Repaint Status</div>
                    <div className="font-bold text-emerald-400 text-[15px] mt-0.5">Zero Repaint</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-800/80">
                  <div className="text-xs text-gray-400 mb-1">Single Account License</div>
                  <div className="text-2xl font-black text-emerald-400 mb-4">$25 <span className="text-[11px] font-normal text-gray-400">USD</span></div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setSelectedProduct({ name: 'Z-Score Volatility Envelope Indicator', price: '25' }); setModalType('demo'); }}
                      className="flex-1 bg-[#1F2937] hover:bg-gray-700 text-white font-medium py-3 rounded-xl text-sm transition flex items-center justify-center gap-2"
                    >
                      <span className="text-blue-400 text-lg">📥</span> Try Demo
                    </button>
                    <button 
                      onClick={() => { setSelectedProduct({ name: 'Z-Score Volatility Envelope Indicator', price: '25' }); setModalType('buy'); }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-sm transition"
                    >
                      Buy License
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* View Placeholders for new Menus */}
        {(activeView === 'dashboard' || activeView === 'disputes' || activeView === 'terms') && (
          <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 animate-in fade-in duration-300">
            <div className="text-4xl">
              {menus.find(m => m.id === activeView)?.icon}
            </div>
            <h2 className="text-2xl font-bold text-white">
              {menus.find(m => m.id === activeView)?.label}
            </h2>
            <p className="text-gray-400 text-sm">
              {activeView === 'terms' 
                ? 'Standard Legal and Service terms apply. Content will be placed here.' 
                : 'This module is currently being provisioned.'}
            </p>
          </div>
        )}

      </div>

      {/* Checkout / License Modal strictly matching Source 4 */}
      {modalType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B1120] border border-[#1e293b] rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-2xl relative">
            
            {/* Close Button */}
            <button onClick={() => setModalType(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
            
            {modalType === 'buy' ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[22px] leading-tight font-black text-white pr-6">License: {selectedProduct?.name}</h3>
                  <p className="text-[13px] font-bold text-[#00c896] mt-1">Amount: ${selectedProduct?.price} USD</p>
                </div>

                <form onSubmit={handleStoreCheckout} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-300 uppercase">Email Address (For File Delivery)</label>
                    <input 
                      required 
                      type="email" 
                      placeholder="trader@example.com"
                      value={modalEmail}
                      onChange={(e) => setModalEmail(e.target.value)}
                      className="w-full bg-[#050810] border border-gray-800 rounded-xl p-3.5 text-gray-300 text-sm focus:border-[#00c896] outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-300 uppercase">MT5 Trading Account Number</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="e.g. 849201"
                      value={mt5Account}
                      onChange={(e) => setMt5Account(e.target.value)}
                      className="w-full bg-[#050810] border border-[#00c896] rounded-xl p-3.5 text-gray-300 text-sm focus:ring-1 focus:ring-[#00c896] outline-none transition-colors"
                    />
                  </div>

                  <div className="bg-[#050810] p-4 rounded-xl border border-gray-800 text-[12px] text-gray-400 space-y-2">
                    <div className="font-bold text-[#00c896] flex items-center gap-2">
                      <span className="text-amber-400">🔒</span> Protected Checkout
                    </div>
                    <div className="pl-1">• Automatic license binding to your MT5 account.</div>
                    <div className="pl-1">• Instant email delivery of compiled `.ex5` file.</div>
                  </div>

                  <button type="submit" className="w-full bg-[#00c896] hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl text-[15px] transition shadow-lg shadow-[#00c896]/20">
                    Pay ${selectedProduct?.price} USD via Paystack
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 bg-[#1F2937] rounded-2xl flex items-center justify-center mx-auto text-3xl">
                  📥
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-lg">Download Demo (.ex5)</h4>
                  <p className="text-sm text-gray-400">
                    Test the system directly on your MT5 strategy tester.
                  </p>
                </div>
                <button onClick={handleDemoDownload} className="w-full bg-[#00c896] hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-[#00c896]/20">
                  Confirm Download
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
