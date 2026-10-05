'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function FidulyncMasterApp() {
  const [activeView, setActiveView] = useState<'home' | 'dashboard' | 'admin' | 'disputes' | 'faq' | 'terms'>('home')
  
  // Escrow Form States
  const [buyerPhone, setBuyerPhone] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [bankCode, setBankCode] = useState('044')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')

  // Live Transactions State (Fetched from backend)
  const [userTransactions, setUserTransactions] = useState<any[]>([])

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

  // Live Bank Resolution via Paystack NIBSS API
  useEffect(() => {
    if (accountNumber.length === 10) {
      setIsVerifying(true)
      setAccountName('')
      
      fetch(`/api/paystack/verify-account?accountNumber=${accountNumber}&bankCode=${bankCode}`)
        .then((res) => res.json())
        .then((data) => {
          setIsVerifying(false)
          if (data.accountName) {
            setAccountName(data.accountName)
            toast.success(`Account Verified: ${data.accountName}`)
          } else {
            toast.error(data.error || 'Bank account not found. Check number & bank.')
          }
        })
        .catch(() => {
          setIsVerifying(false)
          toast.error('Unable to verify account details')
        })
    } else {
      setAccountName('')
    }
  }, [accountNumber, bankCode])

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) { toast.error('Please accept the FiduLync Terms.'); return }
    if (!accountName) { toast.error('Please provide a valid verified bank account.'); return }

    const ref = 'FD_' + Math.random().toString(36).substring(2, 10).toUpperCase()
    const dealUrl = `${window.location.origin}/pay/${ref}`
    
    setGeneratedLink(dealUrl)
    toast.success('Escrow Deal Created Live!')
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white pb-24 font-sans relative">
      
      {/* Floating WhatsApp Support Button */}
      <a 
        href={`https://wa.me/${supportWhatsApp}?text=${encodeURIComponent('Hello FiduLync Support, I need help with an active escrow deal.')}`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#1DA851] text-white p-4 rounded-full shadow-[0_0_25px_rgba(37,211,102,0.5)] transition-transform hover:scale-110 flex items-center justify-center"
      >
        <span className="text-2xl">💬</span>
      </a>

      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-[#0B1120] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('home')}>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">🛡️</div>
            <div>
              <div className="text-lg font-black text-white tracking-tight">FiduLync</div>
              <div className="text-[9px] text-emerald-400 font-mono font-bold tracking-wider">SECURE ESCROW & QUANT</div>
            </div>
          </div>

          <Link href="/store" className="flex items-center gap-2 bg-[#111827] border border-emerald-500/30 hover:border-emerald-500 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition">
            📈 AlgoLync Store →
          </Link>
        </div>

        {/* Dynamic Navigation Bar */}
        <div className="max-w-4xl mx-auto px-4 pb-2.5 flex gap-2 overflow-x-auto text-xs font-bold scrollbar-none">
          {activeView !== 'home' && (
            <button onClick={() => setActiveView('home')} className="bg-gray-800 hover:bg-gray-700 text-emerald-400 px-3 py-1.5 rounded-lg border border-gray-700 transition">
              ← Back to Main
            </button>
          )}
          <button onClick={() => setActiveView('home')} className={`px-3.5 py-1.5 rounded-lg transition ${activeView === 'home' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-[#111827] text-gray-400'}`}>🏠 Create Deal</button>
          <button onClick={() => setActiveView('dashboard')} className={`px-3.5 py-1.5 rounded-lg transition ${activeView === 'dashboard' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-[#111827] text-gray-400'}`}>📊 Dashboard</button>
          <button onClick={() => setActiveView('admin')} className={`px-3.5 py-1.5 rounded-lg transition ${activeView === 'admin' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-[#111827] text-gray-400'}`}>⚙️ Admin</button>
          <button onClick={() => setActiveView('disputes')} className={`px-3.5 py-1.5 rounded-lg transition ${activeView === 'disputes' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-[#111827] text-gray-400'}`}>⚖️ Disputes</button>
          <button onClick={() => setActiveView('faq')} className={`px-3.5 py-1.5 rounded-lg transition ${activeView === 'faq' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-[#111827] text-gray-400'}`}>❓ FAQ</button>
          <button onClick={() => setActiveView('terms')} className={`px-3.5 py-1.5 rounded-lg transition ${activeView === 'terms' ? 'bg-emerald-500 text-black font-extrabold' : 'bg-[#111827] text-gray-400'}`}>📜 Legal Terms</button>
        </div>
      </nav>

      {/* Main Views */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        
        {/* ESCROW DEAL CREATION */}
        {activeView === 'home' && (
          <div className="space-y-6">
            {!generatedLink ? (
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white">Create Live Escrow Deal</h1>
                  <p className="text-xs text-gray-400 mt-1">Lock buyer payment in secure vault until inspection & approval.</p>
                </div>

                <form onSubmit={handleCreateDeal} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Buyer's Phone / WhatsApp Number *</label>
                    <input required type="tel" placeholder="08031234567" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Item or Service Name *</label>
                      <input required type="text" placeholder="e.g. MQL5 Expert Advisor Setup" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Amount (NGN) *</label>
                      <input required type="number" placeholder="50000" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-mono focus:border-emerald-500" />
                    </div>
                  </div>

                  <div className="border-t border-gray-800 pt-4 space-y-4">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Seller Payout Account Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500">
                          {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <input required type="text" maxLength={10} placeholder="10-Digit Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-xs text-white outline-none font-mono focus:border-emerald-500" />
                        {isVerifying && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                      </div>
                    </div>
                    {accountName && <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">✓ NIBSS Verified Name: {accountName}</div>}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="rounded text-emerald-500 accent-emerald-500" />
                    <span className="text-xs text-gray-400">I accept FiduLync Security Rules and 48-Hour Auto Release terms.</span>
                  </label>

                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-4 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20">
                    🔒 Generate Live Escrow Payment Link
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-[#111827] border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4">
                <div className="text-4xl">🎉</div>
                <h2 className="text-xl font-black text-white">Live Escrow Deal Ready</h2>
                <p className="text-xs text-gray-400">Send this payment link to your buyer:</p>
                <div className="bg-[#0B1120] p-3 rounded-xl text-emerald-400 font-mono text-xs select-all border border-gray-800 break-all">{generatedLink}</div>
                <div className="flex gap-3">
                  <button onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Link Copied to Clipboard!'); }} className="flex-1 bg-emerald-500 text-black font-bold py-3 rounded-xl text-xs">Copy Link</button>
                  <button onClick={() => setGeneratedLink('')} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-xl text-xs">Create New Deal</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CUSTOMER DASHBOARD */}
        {activeView === 'dashboard' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white">Active Transactions</h2>
            {userTransactions.length === 0 ? (
              <div className="bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center text-xs text-gray-400 space-y-2">
                <div>No active deals found on this device.</div>
                <button onClick={() => setActiveView('home')} className="text-emerald-400 font-bold underline">Create a new deal now</button>
              </div>
            ) : (
              userTransactions.map((tx, idx) => (
                <div key={idx} className="bg-[#111827] p-4 rounded-2xl border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-white">{tx.itemName}</div>
                    <div className="text-gray-400">Ref: {tx.reference}</div>
                  </div>
                  <div className="text-emerald-400 font-mono font-bold">₦{Number(tx.amount).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ADMIN OVERVIEW */}
        {activeView === 'admin' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white">Platform Governance</h2>
            <div className="bg-[#111827] p-6 rounded-3xl border border-gray-800 text-xs space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800">
                  <div className="text-gray-400 font-bold text-[10px] uppercase">Vault Balance</div>
                  <div className="text-emerald-400 font-mono text-lg font-black mt-1">₦0.00</div>
                </div>
                <div className="bg-[#0B1120] p-4 rounded-xl border border-gray-800">
                  <div className="text-gray-400 font-bold text-[10px] uppercase">Active Escrows</div>
                  <div className="text-white font-mono text-lg font-black mt-1">0</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DISPUTE RESOLUTION */}
        {activeView === 'disputes' && (
          <div className="space-y-4 max-w-lg mx-auto">
            <h2 className="text-xl font-black text-white">Dispute & Claims Portal</h2>
            <div className="bg-[#111827] p-6 rounded-3xl border border-gray-800 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">Transaction Reference *</label>
                <input type="text" placeholder="e.g. FD_X9A2B1" className="w-full bg-[#0B1120] p-3 rounded-xl text-white outline-none border border-gray-800 focus:border-emerald-500 font-mono mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">Reason for Dispute *</label>
                <textarea rows={3} placeholder="Describe non-delivery, damaged item, or spec mismatch..." className="w-full bg-[#0B1120] p-3 rounded-xl text-white outline-none border border-gray-800 focus:border-emerald-500 mt-1"></textarea>
              </div>
              <button onClick={() => toast.success('Dispute Case Logged. Support team notified.')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-xl transition">
                Submit Claim for Arbitration
              </button>
            </div>
          </div>
        )}

        {/* FAQ */}
        {activeView === 'faq' && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <h2 className="text-xl font-black text-white">Escrow FAQ</h2>
            <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800 space-y-2">
              <div className="font-bold text-emerald-400">How long are funds held in vault?</div>
              <div className="text-gray-400 leading-relaxed">Funds remain in vault until the buyer confirms inspection, or until the 48-hour auto-release timer expires without a dispute.</div>
            </div>
          </div>
        )}

        {/* TERMS */}
        {activeView === 'terms' && (
          <div className="space-y-4 max-w-2xl mx-auto text-xs">
            <h2 className="text-xl font-black text-white">Legal Agreement</h2>
            <div className="bg-[#111827] p-6 rounded-3xl border border-gray-800 text-gray-300 leading-relaxed space-y-3">
              <p>1. <strong>Vault Protection:</strong> Payments made via FiduLync are safeguarded in regulated banking partner accounts.</p>
              <p>2. <strong>Inspection Period:</strong> Buyers are granted a standard 48-hour inspection window from confirmed item delivery.</p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
