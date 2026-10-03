export default function FAQPage() {
  const faqs = [
    { q: "What happens if the seller sends a fake or damaged item?", a: "Do NOT click 'Confirm Delivery'. Click the 'Raise Dispute' button immediately. This freezes the funds in our secure vault. Our administrative team will review the case, and if the seller is at fault, your money will be refunded in full." },
    { q: "How much does FiduLync charge?", a: "FiduLync charges a flat 2% platform fee, deducted automatically from the payout sent to the seller." },
    { q: "How long do payouts take?", a: "Once a buyer confirms delivery, the payout is triggered instantly via the Paystack Transfer API. The funds usually reflect in the seller's Nigerian bank account within seconds." },
    { q: "Is FiduLync liable if a transaction goes wrong?", a: "No. FiduLync strictly provides the software to lock funds. We protect your money, but we are not responsible for the actual items being traded. Using our escrow ensures the seller doesn't get paid until you are satisfied." }
  ]

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 p-8 sm:p-16">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-black text-white mb-8">Frequently Asked Questions</h1>
        {faqs.map((faq, i) => (
          <div key={i} className="bg-[#111827] border border-gray-800 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-2">{faq.q}</h3>
            <p className="text-gray-400">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
