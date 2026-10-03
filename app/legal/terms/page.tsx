export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 p-8 sm:p-16 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-black text-white mb-8">Terms of Service & Escrow Agreement</h1>
        <p className="text-sm text-emerald-400">Last Updated: October 2026</p>
        
        <h2 className="text-xl font-bold text-white mt-8">1. FiduLync's Role as a Neutral Third Party</h2>
        <p>FiduLync acts exclusively as an escrow infrastructure provider. We are not a party to the underlying transaction between the Buyer and Seller. We do not guarantee the quality, safety, legality, or delivery of the items or services being sold.</p>
        
        <h2 className="text-xl font-bold text-white mt-8">2. Limitation of Liability</h2>
        <p>Under no circumstances shall FiduLync, its founders, or its team be held liable for any direct, indirect, incidental, or consequential damages resulting from transactions conducted using our platform. Your sole remedy in the event of a dispute is the freezing and potential refund of the escrowed funds according to our Dispute Resolution Policy.</p>

        <h2 className="text-xl font-bold text-white mt-8">3. Dispute Resolution</h2>
        <p>If a Buyer raises a dispute before confirming delivery, funds will remain locked in FiduLync's secure holding account. FiduLync retains absolute discretion in resolving the dispute based on evidence provided by both parties. If mutual agreement cannot be reached, FiduLync may refund the Buyer or release funds to the Seller based on standard verification procedures.</p>

        <h2 className="text-xl font-bold text-white mt-8">4. Prohibited Transactions</h2>
        <p>Users may not use FiduLync for illegal goods, weapons, controlled substances, or fraudulent activities. We reserve the right to report illegal activities to Nigerian law enforcement agencies (e.g., EFCC, Police) and freeze accounts indefinitely.</p>
      </div>
    </div>
  )
}
