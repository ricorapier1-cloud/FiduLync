import Link from 'next/link'

export default function FAQPage() {
  const faqs = [
    {
      q: "How does the Escrow Shield work?",
      a: "The buyer pays FiduLync. We lock the money in a secure vault. The seller delivers the product/service. The buyer confirms receipt, and we instantly route the funds to the seller's bank or digital wallet."
    },
    {
      q: "Which banks and wallets are supported for seller payouts?",
      a: "We support all major commercial banks, plus leading digital wallets including OPay, PalmPay, Moniepoint, and Kuda Bank for instant micro-settlements."
    },
    {
      q: "What happens if the buyer lies about not receiving the item?",
      a: "Sellers are protected. If a buyer claims non-delivery, FiduLync automatically pauses the refund. The seller simply provides proof of delivery/shipping (or digital logs) in the Dispute Center, and our arbitration team will release the funds to the seller."
    },
    {
      q: "How long can funds be held in Escrow?",
      a: "Funds are held securely for up to 14 days. If the buyer does not confirm or dispute within the agreed delivery window, the funds are automatically released to the seller."
    }
  ]

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans selection:bg-emerald-500/30 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-emerald-400 text-sm font-bold hover:underline mb-8 inline-block">← Back to FiduLync</Link>
        
        <div className="mb-10">
          <span className="inline-block bg-[#0ea5e9]/10 text-[#0ea5e9] text-xs font-bold px-3 py-1 rounded-full border border-[#0ea5e9]/20 mb-4">
            Platform Guidelines
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">Rules & FAQ</h1>
          <p className="text-gray-400">Everything you need to know about trading safely on FiduLync.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-[#111827] p-6 rounded-2xl border border-gray-800 shadow-sm transition hover:border-gray-700">
              <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
              <p className="text-sm text-gray-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
