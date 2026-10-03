'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTB)' },
  { code: '039', name: 'Stanbic IBTC Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' }
]

export default function CreateLinkPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verifyingBank, setVerifyingBank] = useState(false)
  
  // Form State
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')

  // Auto-verify bank account when 10 digits and bank code are present
  useEffect(() => {
    async function verifyAccount() {
      if (accountNumber.length === 10 && bankCode) {
        setVerifyingBank(true)
        setAccountName('') // Reset previous name
        
        try {
          const res = await fetch('/api/verify-bank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode })
          })
          
          const data = await res.json()
          
          if (data.success) {
            setAccountName(data.account_name)
            toast.success('Bank account verified!')
          } else {
            toast.error('Could not verify bank account. Check details.')
          }
        } catch (err) {
          toast.error('Network error during verification.')
        } finally {
          setVerifyingBank(false)
        }
      } else {
        setAccountName('')
      }
    }
    
    verifyAccount()
  }, [accountNumber, bankCode])

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Strict block: Do not proceed if KYC verification failed
    if (!accountName) {
      return toast.error('Please verify your bank account before proceeding.')
    }

    setLoading(true)
    const toastId = toast.loading('Generating secure link...')

    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount: Number(amount),
          seller_phone: sellerPhone,
          seller_bank_code: bankCode,
          seller_account: accountNumber,
          seller_account_name: accountName
        })
      })
      
      const data = await res.json()
      
      if (data.link_id) {
        toast.success('Link created safely!', { id: toastId })
        router.push(`/pay/${data.link_id}`)
      } else {
        toast.error(data.error || 'Failed to create link', { id: toastId })
        setLoading(false)
      }
    } catch (err) {
      toast.error('Network error. Try again.', { id: toastId })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-md w-full bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-emerald-400 mb-2">veriPay</h1>
          <p className="text-sm text-gray-400">Zero-risk escrow infrastructure.</p>
        </div>

        <form onSubmit={handleCreateLink} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Item / Service Title</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="e.g. iPhone 13 Pro Max" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Price (₦)</label>
            <input required type="number" min="1000" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="50000" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 uppercase font-bold">Your Phone Number</label>
            <input required type="tel" value={sellerPhone} onChange={e => setSellerPhone(e.target.value)} className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="08012345678" />
          </div>

          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-sm font-bold text-gray-300 mb-4">Payout Account (KYC Required)</h3>
            
            <div className="space-y-4">
              <select required value={bankCode} onChange={e => setBankCode(e.target.value)} className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition text-gray-300">
                <option value="">Select Bank...</option>
                {NIGERIAN_BANKS.map(bank => (
                  <option key={bank.code} value={bank.code}>{bank.name}</option>
                ))}
              </select>

              <div className="relative">
                <input required type="text" maxLength={10} value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#0B1120] border border-gray-700 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="10-digit Account Number" />
                {verifyingBank && (
                  <div className="absolute right-3 top-3 animate-spin rounded-full h-5 w-5 border-t-2 border-emerald-500"></div>
                )}
              </div>

              {accountName && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-sm font-bold flex items-center space-x-2">
                  <span>✅</span>
                  <span>{accountName}</span>
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !accountName || verifyingBank} 
            className="w-full bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-extrabold py-4 px-6 rounded-xl mt-6 transition"
          >
            {loading ? 'Creating...' : 'Create Safe Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
