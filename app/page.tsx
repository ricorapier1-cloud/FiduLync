'use client'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function FidulyncMasterApp() {
  // Navigation & Role Simulation State Switcher
  const [activeView, setActiveView] = useState<'home' | 'store' | 'dashboard' | 'admin' | 'disputes' | 'faq' | 'terms'>('home')
  const [userRole, setUserRole] = useState<'public' | 'customer' | 'admin'>('public')
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')

  // Escrow Form State with 25+ Banks & Auto-Converter
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  const [convertedPrice, setConvertedPrice] = useState('')
  const [bankCode, setBankCode] = useState('044')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isVerifyingBank, setIsVerifyingBank] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [waShareLink, setWaShareLink] = useState('')

  // Store Modal State
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [storeModalType, setStoreModalType] = useState<'buy' | 'demo' | null>(null)
  const [modalEmail, setModalEmail] = useState('')
  const [mt5Account, setMt5Account] = useState('')

  const supportWhatsApp = '2348037212445'

  // 25+ Nigerian & African Banks
  const banksList = [
    { code: '044', name: 'Access Bank' },
    { code: '063', name: 'Access Bank (Diamond)' },
    { code: '035', name: 'ALAT by Wema' },
    { code: '401', name: 'ASO Savings and Loans' },
    { code: '50931', name: 'Bowen Microfinance Bank' },
    { code: '050', name: 'Ecobank Nigeria' },
    { code: '562', name: 'Ekondo Microfinance Bank' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '214', name: 'First City Monument Bank (FCMB)' },
    { code: '50126', name: 'Gladstone MFB' },
    { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
    { code: '030', name: 'Heritage Bank' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '50211', name: 'Kuda Bank' },
    { code: '50515', name: 'Moniepoint MFB' },
    { code: '014', name: 'MainStreet Bank' },
    { code: '100004', name: 'OPay Digital Services' },
    { code: '100033', name: 'PalmPay' },
    { code: '526', name: 'Parallex Bank' },
    { code: '076', name: 'Polaris Bank' },
    { code: '101', name: 'Providus Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '068', name: 'Standard Chartered Bank' },
    { code: '232', name: 'Sterling Bank' },
    { code: '100', name: 'Suntrust Bank' },
    { code: '302', name: 'TAJ Bank' },
    { code: '102', name: 'Titan Trust Bank' },
    { code: '032', name: 'Union Bank of Nigeria' },
    { code: '033', name: 'United Bank for Africa (UBA)' },
    { code: '215', name: 'Unity Bank' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' }
  ]

  // Auto Currency Converter Effect
  useEffect(() => {
    if (itemPrice && !isNaN(Number(itemPrice))) {
      const val = Number(itemPrice)
      if (currency === 'NGN') setConvertedPrice(`≈ $${(val / 1650).toFixed(2)} USD | €${(val / 1780).toFixed(2)} EUR`)
      else if (currency === 'USD') setConvertedPrice(`≈ ₦${(val * 1650).toLocaleString()} NGN`)
      else if (currency === 'GHS') setConvertedPrice(`≈ ₦${(val * 125).toLocaleString()} NGN`)
      else if (currency === 'KES') setConvertedPrice(`≈ ₦${(val * 12).toLocaleString()} NGN`)
    } else {
      setConvertedPrice('')
    }
  }, [itemPrice, currency])

  // Auto Bank Verification Mock
  useEffect(() => {
    if (accountNumber.length === 10) {
      setIsVerifyingBank(true)
      setAccountName('')
      const timer = setTimeout(() => {
        setIsVerifyingBank(false)
        setAccountName('AKINSOOTO ERIC AKINWALE')
        toast.success('Bank Account Verified via NIBSS!')
      }, 1200)
      return () => clearTimeout(timer)
    } else {
      setAccountName('')
    }
  }, [accountNumber, bankCode])

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success(authMode === 'signin' ? 'Successfully Signed In!' : 'Account Created Successfully!')
    setUserRole('customer')
    setIsAuthModalOpen(false)
    setActiveView('dashboard')
  }

  const handleCreateEscrow = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) {
      toast.error('You must accept the Terms & Conditions.')
      return
    }
    if (!accountName) {
      toast.error('Please verify the seller bank account.')
      return
    }
    const lid = Math.random().toString(36).substring(2, 10)
    const url = `https://fidulync.com/pay/${lid}`
    setGeneratedLink(url)
    const msg = `Hello! Secured escrow link created for "${itemName}" (${currency} ${itemPrice}). Pay safely here: ${url}`
    setWaShareLink(`https://wa.me/${buyerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`)
    toast.success('Escrow Link Generated Successfully!')
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white pb-24 font-sans selection:bg-emerald-500/30 relative">
      
      {/* Floating WhatsApp Support Button (+2348037212445) */}
      <a 
        href={`https://wa.me/${supportWhatsApp}?text=Hello FiduLync Support, I need assistance with...`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#1DA851] text-white p-4 rounded-full shadow-[0_0_25px_rgba(37,211,102,0.5)] transition-transform hover:scale-110 flex items-center justify-center"
      >
        <span className="text-2xl">💬</span>
      </a>

      {/* Header & Navigation */}
      <nav className="border-b border-gray-800/80 bg-[#0B1120]/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex justify-between items-center">
          
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('home')}>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg">🛡️</div>
            <div>
              <div className="text-lg font-black tracking-tight leading-none text-white">FiduLync</div>
              <div className="text-[9px] text-emerald-400 font-mono font-bold tracking-widest mt-0.5">SECURE ESCROW & QUANT</div>
            </div>
          </div>

          {/* Elite AlgoLync Store Card & Auth State Switcher */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveView('store')}
              className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#1F2937] border border-emerald-500/30 hover:border-emerald-500 transition shadow-lg group"
            >
              <div className="text-emerald-400 text-base">📈</div>
              <div className="text-left">
                <div className="text-xs font-black text-white group-hover:text-emerald-400 transition">AlgoLync Store</div>
                <div className="text-[9px] text-gray-400 font-mono">MQL5 EAs & Algos</div>
              </div>
              <span className="text-emerald-400 text-sm font-bold pl-1 group-hover:translate-x-1 transition">→</span>
            </button>

            {userRole === 'public' ? (
              <button 
                onClick={() => { setAuthMode('signin'); setIsAuthModalOpen(true); }}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-4 py-2 rounded-xl text-xs transition shadow-md shadow-emerald-500/20"
              >
                Sign In / Register
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                  {userRole === 'admin' ? '👑 Admin Panel' : '👤 Customer Dashboard'}
                </span>
                <button 
                  onClick={() => { setUserRole('public'); setActiveView('home'); toast.success('Logged out successfully'); }}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Professional Navigation Menu Bar */}
        <div className="max-w-5xl mx-auto px-4 pb-2.5 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveView('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'home' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            🏠 Escrow Home
          </button>
          <button 
            onClick={() => setActiveView('store')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'store' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            🤖 AlgoLync Store
          </button>
          <button 
            onClick={() => setActiveView('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'dashboard' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            📊 Customer Dashboard
          </button>
          <button 
            onClick={() => setActiveView('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'admin' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            ⚙️ Admin Control Panel
          </button>
          <button 
            onClick={() => setActiveView('disputes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'disputes' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            ⚖️ Dispute & Resolution
          </button>
          <button 
            onClick={() => setActiveView('faq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'faq' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            ❓ FAQ
          </button>
          <button 
            onClick={() => setActiveView('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeView === 'terms' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400 hover:text-white'}`}
          >
            📜 Legal & Terms
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        
        {/* ================= 1. ESCROW HOME VIEW ================= */}
        {activeView === 'home' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* Trust Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111827] border border-gray-800 rounded-2xl p-4 text-center">
              <div>
                <div className="text-xl font-black text-emerald-400">100%</div>
                <div className="text-[10px] text-gray-400 uppercase mt-0.5">Scam Immunity</div>
              </div>
              <div>
                <div className="text-xl font-black text-white">&lt; 2 Mins</div>
                <div className="text-[10px] text-gray-400 uppercase mt-0.5">Bank Payout</div>
              </div>
              <div>
                <div className="text-xl font-black text-white">2% Fee</div>
                <div className="text-[10px] text-gray-400 uppercase mt-0.5">Low Flat Rate</div>
              </div>
              <div>
                <div className="text-xl font-black text-white">PAYSTACK</div>
                <div className="text-[10px] text-gray-400 uppercase mt-0.5">Secured Rails</div>
              </div>
            </div>

            {!generatedLink ? (
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-white">Create Safe Escrow Link</h1>
                  <p className="text-xs sm:text-sm text-gray-400">Lock buyer funds securely and disburse instantly upon delivery.</p>
                </div>

                <form onSubmit={handleCreateEscrow} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Buyer's WhatsApp Phone *</label>
                    <input 
                      required type="tel" placeholder="e.g. 08000000000"
                      value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-mono focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Item Name *</label>
                      <input 
                        required type="text" placeholder="e.g. iPhone 14 Pro Max"
                        value={itemName} onChange={(e) => setItemName(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Description</label>
                      <input 
                        type="text" placeholder="Condition, specs..."
                        value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Currency</label>
                      <select 
                        value={currency} onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-bold focus:border-emerald-500 outline-none"
                      >
                        <option value="NGN">NGN (₦)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GHS">GHS (₵)</option>
                        <option value="KES">KES (KSh)</option>
                      </select>
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Amount *</label>
                      <input 
                        required type="number" placeholder="500000"
                        value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                        className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-mono font-bold focus:border-emerald-500 outline-none"
                      />
                      {convertedPrice && (
                        <div className="absolute right-3 top-9 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          {convertedPrice}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seller Payout Section with 25+ Banks & NIBSS Verification */}
                  <div className="pt-4 border-t border-gray-800 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <span>🏦</span> Seller Payout Account (Automated Verification)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Select Bank</label>
                        <select 
                          value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                          className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm focus:border-emerald-500 outline-none"
                        >
                          {banksList.map(b => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Account Number (10 Digits)</label>
                        <div className="relative">
                          <input 
                            required type="text" maxLength={10} placeholder="0123456789"
                            value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-white text-sm font-mono focus:border-emerald-500 outline-none"
                          />
                          {isVerifyingBank && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                        </div>
                        {accountName && <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded inline-block">✓ {accountName}</div>}
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
                        I agree to FiduLync <span className="text-emerald-400 underline" onClick={(e) => { e.preventDefault(); setActiveView('terms'); }}>Terms, Conditions & Dispute Rules</span>.
                      </span>
                    </label>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm tracking-wide"
                  >
                    🔒 Generate Secured Escrow Link
                  </button>
                </form>
              </div>
            ) : (
              /* SUCCESS GENERATED LINK */
              <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-8 space-y-6 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">🎉</div>
                <div>
                  <h2 className="text-2xl font-black text-white">Escrow Link Ready!</h2>
                  <p className="text-sm text-gray-400 mt-1">Share this secured link with your buyer.</p>
                </div>
                <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800 flex items-center justify-between gap-3">
                  <div className="text-emerald-400 font-mono text-sm truncate select-all">{generatedLink}</div>
                  <button onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Copied!'); }} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold">COPY</button>
                </div>
                <div className="space-y-3 pt-2">
                  <a href={waShareLink} target="_blank" rel="noopener noreferrer" className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition">
                    <span>💬</span> Send to Buyer via WhatsApp Immediately
                  </a>
                  <button onClick={() => setGeneratedLink('')} className="w-full bg-transparent border border-gray-700 text-gray-300 font-bold py-3.5 rounded-xl">Create Another Link</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 2. ALGOLYNC STORE VIEW ================= */}
        {activeView === 'store' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <div className="text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase">AlgoLync Quant Suite</div>
              <h1 className="text-3xl sm:text-5xl font-black text-white">Institutional MT5 Systems</h1>
              <p className="text-sm text-gray-400 max-w-md mx-auto">Automated quantitative trading algorithms with instant license binding & file delivery.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex justify-between items-center"><span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">Flagship EA</span><span className="font-mono text-xs text-gray-500">v2.4</span></div>
                <div>
                  <h2 className="text-xl font-black text-white">ERIDAM NEXUS ADAPTIVE PRO</h2>
                  <p className="text-xs text-gray-400 mt-2">Kaufman Efficiency Ratio filtering with dynamic ATR risk management and high-watermark equity shield.</p>
                </div>
                <div className="bg-[#0B1120] p-4 rounded-2xl grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-gray-500 block uppercase">Win Rate</span><strong className="text-emerald-400 text-sm">74.2%</strong></div>
                  <div><span className="text-gray-500 block uppercase">Profit Factor</span><strong className="text-emerald-400 text-sm">2.14</strong></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', price: '49' }); setStoreModalType('demo'); }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-xs">📥 Free Demo</button>
                  <button onClick={() => { setSelectedProduct({ name: 'ERIDAM NEXUS ADAPTIVE PRO', price: '49' }); setStoreModalType('buy'); }} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-xs">Buy ($49)</button>
                </div>
              </div>

              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex justify-between items-center"><span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">Indicator</span><span className="font-mono text-xs text-gray-500">v1.1</span></div>
                <div>
                  <h2 className="text-xl font-black text-white">Z-Score Volatility Envelope</h2>
                  <p className="text-xs text-gray-400 mt-2">Real-time standard deviation breakout mapper featuring adaptive ALMA moving average filters.</p>
                </div>
                <div className="bg-[#0B1120] p-4 rounded-2xl grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-gray-500 block uppercase">Accuracy</span><strong className="text-emerald-400 text-sm">81.0%</strong></div>
                  <div><span className="text-gray-500 block uppercase">Repaint</span><strong className="text-emerald-400 text-sm">Zero Repaint</strong></div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setSelectedProduct({ name: 'Z-Score Volatility Envelope', price: '25' }); setStoreModalType('demo'); }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-xs">📥 Free Demo</button>
                  <button onClick={() => { setSelectedProduct({ name: 'Z-Score Volatility Envelope', price: '25' }); setStoreModalType('buy'); }} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-xs">Buy ($25)</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. CUSTOMER DASHBOARD ================= */}
        {activeView === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-white">Customer Transaction Dashboard</h2>
              <button onClick={() => setUserRole('admin')} className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-500/30">Switch to Admin View</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Active Sales</div><div className="text-2xl font-black text-emerald-400">2</div></div>
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Active Purchases</div><div className="text-2xl font-black text-white">1</div></div>
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Completed Deals</div><div className="text-2xl font-black text-white">14</div></div>
              <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Total Volume</div><div className="text-2xl font-black text-emerald-400">₦1.85M</div></div>
            </div>
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-white">Your Escrow History</h3>
              <div className="space-y-3">
                <div className="bg-[#0B1120] p-4 rounded-2xl flex justify-between items-center text-xs">
                  <div><div className="font-bold text-white">iPhone 14 Pro Max</div><div className="text-gray-400">Buyer: 0803•••••••</div></div>
                  <div className="text-right"><div className="font-mono font-bold text-emerald-400">₦650,000</div><span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">Escrow Locked</span></div>
                </div>
                <div className="bg-[#0B1120] p-4 rounded-2xl flex justify-between items-center text-xs">
                  <div><div className="font-bold text-white">Eridam Nexus Pro (EA)</div><div className="text-gray-400">License: #MT5-94820</div></div>
                  <div className="text-right"><div className="font-mono font-bold text-emerald-400">$49.00</div><span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Completed & Delivered</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. ADMIN CONTROL PANEL ================= */}
        {activeView === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex justify-between items-center">
              <div><h2 className="text-xl font-black text-red-400">Admin Control & Dispute Override</h2><p className="text-xs text-gray-400">Authorized personnel only. Full platform fund override access.</p></div>
              <button onClick={() => setUserRole('customer')} className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-xl">Switch to Customer View</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#111827] p-5 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Total System Escrow</div><div className="text-2xl font-black text-white">₦14.2M</div></div>
              <div className="bg-[#111827] p-5 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Pending Dispatches</div><div className="text-2xl font-black text-amber-400">6</div></div>
              <div className="bg-[#111827] p-5 rounded-2xl border border-gray-800"><div className="text-xs text-gray-400">Active Disputes</div><div className="text-2xl font-black text-red-400">0</div></div>
            </div>
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-white">Global Transaction Management</h3>
              <div className="bg-[#0B1120] p-4 rounded-2xl flex justify-between items-center text-xs">
                <div><div className="font-bold text-white">MacBook Pro M2</div><div className="text-gray-400">Seller: Akinsooto | Buyer: 080••••••••</div></div>
                <div className="flex gap-2">
                  <button onClick={() => toast.success('Payout Released to Seller!')} className="bg-emerald-500 text-black font-bold px-3 py-1.5 rounded-lg">Override Release</button>
                  <button onClick={() => toast.success('Refunded to Buyer!')} className="bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg">Refund Buyer</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 5. DISPUTE & RESOLUTION CENTER ================= */}
        {activeView === 'disputes' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl mx-auto">
            <h2 className="text-2xl font-black text-white">Dispute & Proof Submission Center</h2>
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-5">
              <p className="text-xs text-gray-400 leading-relaxed">If an item was not delivered as described or you experienced a defect, submit your evidence (unboxing video or dispatch receipt) here for instant AI arbitration.</p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase">Transaction ID or Link</label>
                <input type="text" placeholder="e.g. fidulync.com/pay/xyz123" className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-xs text-white outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase">Reason for Dispute</label>
                <select className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3.5 text-xs text-white outline-none">
                  <option>Item not received</option>
                  <option>Item materially different from description</option>
                  <option>Digital file / EA license key invalid</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase">Upload Evidence (Video / Receipt)</label>
                <input type="file" className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-black" />
              </div>
              <button onClick={() => toast.success('Dispute submitted successfully! Our arbitration team will review within 2 hours.')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs transition">Submit Dispute Evidence</button>
            </div>
          </div>
        )}

        {/* ================= 6. FAQ VIEW ================= */}
        {activeView === 'faq' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-white border-b border-gray-800 pb-4">Frequently Asked Questions</h2>
            <div className="space-y-4 text-sm">
              <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 space-y-2">
                <h3 className="font-bold text-emerald-400">1. How does FiduLync Escrow protect me?</h3>
                <p className="text-xs text-gray-400 leading-relaxed">When a buyer pays, the money is locked in an audited escrow vault. The seller is notified to dispatch the item. Once the buyer receives and verifies the item, they click "Confirm", and funds are instantly disbursed to the seller's bank account.</p>
              </div>
              <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 space-y-2">
                <h3 className="font-bold text-emerald-400">2. What happens if there is a dispute?</h3>
                <p className="text-xs text-gray-400 leading-relaxed">Either party can open a dispute. Both buyer and seller upload their proof (delivery waybills, unboxing videos). Our resolution team reviews the evidence and issues a fair ruling within 24 hours.</p>
              </div>
              <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 space-y-2">
                <h3 className="font-bold text-emerald-400">3. How do I get support quickly?</h3>
                <p className="text-xs text-gray-400 leading-relaxed">You can click the floating WhatsApp button at the bottom-right corner of the screen or message our support line directly at +2348037212445.</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. LEGAL & TERMS VIEW ================= */}
        {activeView === 'terms' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-white border-b border-gray-800 pb-4">Terms, Conditions & Safety Agreement</h2>
            <div className="space-y-6 text-xs text-gray-300 leading-relaxed">
              <div className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-sm">1. 48-Hour Auto-Payout Rule</h3>
                <p>If a buyer fails to confirm delivery or raise a dispute within 48 hours of confirmed courier delivery, funds are automatically released to the seller to prevent malicious withholding.</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-sm">2. Anti-Money Laundering (AML) & Compliance</h3>
                <p>FiduLync adheres to strict Nigerian and international financial regulations. All transactions are screened for illicit activity, and suspicious accounts are subject to temporary suspension.</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-emerald-400 font-bold text-sm">3. Chargeback & Fraud Protection</h3>
                <p>By using FiduLync, both parties agree that escrow transactions processed through Paystack are final upon delivery confirmation and protected against fraudulent chargebacks.</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-6 relative shadow-2xl">
            <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
            <div>
              <h3 className="text-xl font-black text-white">{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h3>
              <p className="text-xs text-gray-400 mt-1">Access your FiduLync dashboard & sales history.</p>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Email Address</label>
                <input required type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="trader@example.com" className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Password</label>
                <input required type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none" />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl text-xs transition">
                {authMode === 'signin' ? 'Sign In to Dashboard' : 'Register Account'}
              </button>
            </form>
            <div className="text-center">
              <button onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')} className="text-xs text-emerald-400 hover:underline">
                {authMode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Modal */}
      {storeModalType && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B1120] border border-gray-800 rounded-3xl p-6 max-w-sm w-full space-y-5 relative">
            <button onClick={() => setStoreModalType(null)} className="absolute top-4 right-4 text-gray-400">✕</button>
            <h3 className="text-lg font-black text-white">{selectedProduct?.name}</h3>
            {storeModalType === 'buy' ? (
              <div className="space-y-4">
                <div className="text-emerald-400 font-mono font-bold text-lg">${selectedProduct?.price} USD</div>
                <input type="text" placeholder="MT5 Account Number" value={mt5Account} onChange={(e) => setMt5Account(e.target.value)} className="w-full bg-[#070B14] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none" />
                <button onClick={() => { toast.success('Redirecting to Paystack...'); setStoreModalType(null); }} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">Pay via Paystack</button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-xs text-gray-400">Download trial version (.ex5) for MT5 Strategy Tester.</p>
                <button onClick={() => { toast.success('Demo downloaded successfully!'); setStoreModalType(null); }} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">Confirm Download</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
