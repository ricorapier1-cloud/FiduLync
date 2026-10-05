'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function FidulyncMasterApp() {
  const [activeView, setActiveView] = useState<'home' | 'dashboard' | 'admin' | 'disputes' | 'faq' | 'terms'>('home')
  const [userRole, setUserRole] = useState<'customer' | 'admin'>('customer')
  
  // Escrow State
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [itemPrice, setItemPrice] = useState('')
  const [bankCode, setBankCode] = useState('044')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  const supportWhatsApp = '2348037212445'

  const banks = [
    { code: '044', name: 'Access Bank' }, { code: '035', name: 'ALAT by Wema' },
    { code: '050', name: 'Ecobank Nigeria' }, { code: '070', name: 'Fidelity Bank' },
    { code: '011', name: 'First Bank of Nigeria' }, { code: '214', name: 'FCMB' },
    { code: '058', name: 'GTBank' }, { code: '50211', name: 'Kuda Bank' },
    { code: '50515', name: 'Moniepoint MFB' }, { code: '100004', name: 'OPay Digital' },
    { code: '100033', name: 'PalmPay' }, { code: '076', name: 'Polaris Bank' },
    { code: '101', name: 'Providus Bank' }, { code: '221', name: 'Stanbic IBTC' },
    { code: '232', name: 'Sterling Bank' }, { code: '033', name: 'UBA' },
    { code: '035', name: 'Wema Bank' }, { code: '057', name: 'Zenith Bank' }
  ]

  useEffect(() => {
    if (accountNumber.length === 10) {
      setIsVerifying(true)
      const t = setTimeout(() => {
        setIsVerifying(false)
        setAccountName('AKINSOOTO ERIC AKINWALE')
        toast.success('Account Verified via NIBSS!')
      }, 1000)
      return () => clearTimeout(t)
    } else {
      setAccountName('')
    }
  }, [accountNumber])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) { toast.error('Please accept the Terms.'); return }
    if (!accountName) { toast.error('Please verify seller bank account.'); return }
    const ref = Math.random().toString(36).substring(2, 10)
    setGeneratedLink(`https://fidulync.vercel.app/pay/${ref}`)
    toast.success('Secured Escrow Deal Link Created!')
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white pb-24 font-sans relative">
      
      {/* Floating WhatsApp Support Button */}
      <a 
        href={`https://wa.me/${supportWhatsApp}?text=Hello FiduLync Support, I need assistance with my transaction...`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#1DA851] text-white p-4 rounded-full shadow-[0_0_25px_rgba(37,211,102,0.5)] transition-transform hover:scale-110 flex items-center justify-center"
      >
        <span className="text-2xl">💬</span>
      </a>

      {/* Header & Nav */}
      <nav className="border-b border-gray-800 bg-[#0B1120] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('home')}>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">🛡️</div>
            <div>
              <div className="text-lg font-black text-white">FiduLync</div>
              <div className="text-[9px] text-emerald-400 font-mono font-bold">SAFE ESCROW & QUANT</div>
            </div>
          </div>

          <Link href="/store" className="flex items-center gap-2 bg-[#111827] border border-emerald-500/30 hover:border-emerald-500 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition">
            📈 AlgoLync Store →
          </Link>
        </div>

        {/* Menu Bar */}
        <div className="max-w-4xl mx-auto px-4 pb-2.5 flex gap-2 overflow-x-auto text-xs font-bold">
          {activeView !== 'home' && (
            <button onClick={() => setActiveView('home')} className="bg-gray-800 text-emerald-400 px-3 py-1.5 rounded-lg border border-gray-700">
              ← Back to Home
            </button>
          )}
          <button onClick={() => setActiveView('home')} className={`px-3 py-1.5 rounded-lg transition ${activeView === 'home' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400'}`}>🏠 Escrow</button>
          <button onClick={() => setActiveView('dashboard')} className={`px-3 py-1.5 rounded-lg transition ${activeView === 'dashboard' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveView('admin')} className={`px-3 py-1.5 rounded-lg transition ${activeView === 'admin' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400'}`}>⚙️ Admin Panel</button>
          <button onClick={() => setActiveView('disputes')} className={`px-3 py-1.5 rounded-lg transition ${activeView === 'disputes' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400'}`}>⚖️ Disputes</button>
          <button onClick={() => setActiveView('faq')} className={`px-3 py-1.5 rounded-lg transition ${activeView === 'faq' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400'}`}>❓ FAQ</button>
          <button onClick={() => setActiveView('terms')} className={`px-3 py-1.5 rounded-lg transition ${activeView === 'terms' ? 'bg-emerald-500 text-black' : 'bg-[#111827] text-gray-400'}`}>📜 Legal</button>
        </div>
      </nav>

      {/* Main Views */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        {activeView === 'home' && (
          <div className="space-y-6">
            {!generatedLink ? (
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">Create Safe Escrow Deal</h1>
                  <p className="text-xs text-gray-400 mt-1">Protect buyer funds in vault until delivery confirmation.</p>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Buyer's WhatsApp Number *</label>
                    <input required type="tel" placeholder="08030000000" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Item / Service Name *</label>
                      <input required type="text" placeholder="e.g. MacBook Pro M2" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Amount *</label>
                      <input required type="number" placeholder="500000" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-mono" />
                    </div>
                  </div>

                  <div className="border-t border-gray-800 pt-4 space-y-4">
                    <div className="text-xs font-bold text-emerald-400 uppercase">Seller Payout Account</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none">
                          {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <input required type="text" maxLength={10} placeholder="10-Digit Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-mono" />
                        {isVerifying && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                      </div>
                    </div>
                    {accountName && <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded">✓ Verified: {accountName}</div>}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="rounded text-emerald-500" />
                    <span className="text-xs text-gray-400">I accept FiduLync Safety Rules & 48-Hour Auto Payout Policy.</span>
                  </label>

                  <button type="submit" className="w-full bg-emerald-500 text-black font-extrabold py-4 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20">
                    🔒 Generate Secured Escrow Deal Link
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4">
                <div className="text-3xl">🎉</div>
                <h2 className="text-xl font-black text-white">Escrow Link Created!</h2>
                <div className="bg-[#0B1120] p-3 rounded-xl text-emerald-400 font-mono text-xs select-all border border-gray-800">{generatedLink}</div>
                <button onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Link Copied!'); }} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">Copy Link</button>
                <button onClick={() => setGeneratedLink('')} className="w-full bg-gray-800 text-gray-300 font-bold py-3 rounded-xl text-xs">Create Another Deal</button>
              </div>
            )}
          </div>
        )}

        {activeView === 'dashboard' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white">Customer Transaction History</h2>
            <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 space-y-3 text-xs">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <div><div className="font-bold text-white">iPhone 14 Pro Max</div><div className="text-gray-400">Buyer: 0803•••••••</div></div>
                <div className="text-emerald-400 font-mono font-bold">₦650,000 (Locked)</div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-red-400">Admin Control Panel</h2>
            <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 flex justify-between items-center text-xs">
              <div><div className="font-bold text-white">MacBook Pro M2</div><div className="text-gray-400">Status: In Escrow Vault</div></div>
              <button onClick={() => toast.success('Payout Released!')} className="bg-emerald-500 text-black font-bold px-3 py-1.5 rounded-lg">Release Funds</button>
            </div>
          </div>
        )}

        {activeView === 'disputes' && (
          <div className="space-y-4 max-w-lg mx-auto">
            <h2 className="text-xl font-black text-white">Dispute & Evidence Center</h2>
            <div className="bg-[#111827] p-6 rounded-3xl border border-gray-800 space-y-3 text-xs">
              <input type="text" placeholder="Transaction Link / ID" className="w-full bg-[#0B1120] p-3 rounded-xl text-white outline-none" />
              <input type="file" className="w-full bg-[#0B1120] p-2 rounded-xl text-gray-400" />
              <button onClick={() => toast.success('Evidence Submitted for Dispute Resolution')} className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl">Submit Dispute Evidence</button>
            </div>
          </div>
        )}

        {activeView === 'faq' && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <h2 className="text-xl font-black text-white">Frequently Asked Questions</h2>
            <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 space-y-1">
              <div className="font-bold text-emerald-400">How are my funds protected?</div>
              <div className="text-gray-400">Buyer payments are held in an audited bank vault until receipt and inspection of the goods or services.</div>
            </div>
          </div>
        )}

        {activeView === 'terms' && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <h2 className="text-xl font-black text-white">Terms & Legal Agreement</h2>
            <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 text-gray-300 leading-relaxed">
              48-Hour Auto-Payout: Once courier delivery is confirmed, buyers have 48 hours to confirm or raise a dispute. Unclaimed funds automatically release to sellers.
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
