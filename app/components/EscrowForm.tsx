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

interface FormProps {
  buyerPhone: string; setBuyerPhone: (v: string) => void
  itemName: string; setItemName: (v: string) => void
  itemPrice: string; setItemPrice: (v: string) => void
}

export default function EscrowForm({ buyerPhone, setBuyerPhone, itemName, setItemName, itemPrice, setItemPrice }: FormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verifyingBank, setVerifyingBank] = useState(false)

  const [itemDescription, setItemDescription] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [bankCode, setBankCode] = useState('044')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')

  useEffect(() => {
    async function verifyAccount() {
      if (accountNumber.length === 10 && bankCode) {
        setVerifyingBank(true)
        setAccountName('')
        
        try {
          const res = await fetch('/api/verify-bank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode })
          })
          const data = await res.json()
          if (data.success) {
            setAccountName(data.account_name)
            toast.success('Payout account verified!')
          } else {
            toast.error('Invalid account details.')
          }
        } catch (err) {
          toast.error('Verification network error.')
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
    if (!accountName) return toast.error('Bank account verification required.')

    setLoading(true)
    const toastId = toast.loading('Securing transaction...')

    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: itemName,
          description: itemDescription,
          amount: Number(itemPrice),
          buyer_phone: buyerPhone,
          seller_phone: sellerPhone,
          seller_bank_code: bankCode,
          seller_account: accountNumber,
          seller_account_name: accountName
        })
      })
      const data = await res.json()
      if (data.link_id) {
        toast.success('Safe Link Generated!', { id: toastId })
        router.push(`/pay/${data.link_id}`)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      toast.error('Failed to generate link.', { id: toastId })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCreateLink} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1 font-bold">BUYER'S WHATSAPP PHONE *</label>
        <input required type="tel" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="e.g. 08000000000" />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1 font-bold">ITEM NAME *</label>
        <input required type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="📦 e.g. iPhone 14 Pro Max" />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1 font-bold">ITEM DESCRIPTION</label>
        <textarea rows={2} value={itemDescription} onChange={e => setItemDescription(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="e.g. Brand new, 256GB Deep Purple, original box included..." />
      </div>

      <div className="flex space-x-4">
        <div className="w-1/3">
          <label className="block text-xs text-gray-400 mb-1 font-bold">CURRENCY</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none">
            <option value="NGN">NGN (₦)</option>
          </select>
        </div>
        <div className="w-2/3">
          <label className="block text-xs text-gray-400 mb-1 font-bold">ITEM PRICE *</label>
          <input required type="number" min="1000" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full bg-[#0B1120] border border-gray-800 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition" placeholder="₦ 650000" />
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-gray-800">
        <h3 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-wider flex items-center">
          <span className="mr-2">🏦</span> SELLER PAYOUT ACCOUNT <span className="text-gray-500 ml-2 font-normal capitalize">Where seller gets paid</span>
        </h3>
        
        <div className="space-y-4 bg-[#0B1120] p-4 rounded-xl border border-gray-800">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
            <select required value={bankCode} onChange={e => setBankCode(e.target.value)} className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-sm focus:border-emerald-500 outline-none">
              {NIGERIAN_BANKS.map(bank => (
                <option key={bank.code} value={bank.code}>{bank.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Account Number (10 Digits)</label>
            <input required type="text" maxLength={10} value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-sm focus:border-emerald-500 outline-none" placeholder="0123456789" />
            {verifyingBank && <div className="absolute right-3 top-8 animate-spin rounded-full h-4 w-4 border-t-2 border-emerald-500"></div>}
          </div>

          {accountName && (
            <div className="text-xs text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex items-center">
              <span className="mr-2">✅</span> Verified: {accountName}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Seller WhatsApp Phone</label>
            <input required type="tel" value={sellerPhone} onChange={e => setSellerPhone(e.target.value)} className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-sm focus:border-emerald-500 outline-none" placeholder="e.g. 08000000000" />
          </div>
        </div>
      </div>

      <button type="submit" disabled={loading || !accountName || verifyingBank} className="w-full bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-black font-extrabold py-4 px-6 rounded-xl mt-6 transition hover:bg-emerald-400">
        {loading ? 'Securing Link...' : '🔒 Generate Safe Link'}
      </button>
    </form>
  )
}
