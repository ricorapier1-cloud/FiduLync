import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-6 py-12 max-w-4xl mx-auto font-sans">
      <Link href="/" className="text-emerald-600 font-semibold text-sm hover:underline">← Back to FiduLync</Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: September 30, 2026</p>

      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">1. Information We Collect</h2>
          <p>FiduLync collects necessary transactional information including email addresses, phone numbers, item descriptions, and transaction values to facilitate secure peer-to-peer escrow payments.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">2. How We Use Your Information</h2>
          <p>Your information is exclusively used to generate escrow links, notify parties of payment status updates, process payouts via our payment processor (Paystack), and resolve trade disputes.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">3. Data Security & Third Parties</h2>
          <p>We do not store complete payment credentials on our servers. Financial details are securely processed directly through PCI-DSS compliant channels. Your data is never sold or rented to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-2">4. Contact Us</h2>
          <p>For data inquiries or account privacy questions, contact support at <a href="mailto:support@fidulync.com" className="text-emerald-600 hover:underline">support@fidulync.com</a>.</p>
        </section>
      </div>
    </main>
  )
}
