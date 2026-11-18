import Link from 'next/link';

export const metadata = {
  title: 'Refund & Cancellation Policy | FiduLync',
  description: 'Refund, recurring subscription cancellation, billing correction and digital software delivery policy for MacroLync and AlgoLync.',
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[#080a0f] text-slate-100">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <header className="border-b border-white/10 pb-7">
          <Link href="/store" className="text-xs text-emerald-300 underline underline-offset-4">Back to AlgoLync Store</Link>
          <div className="mt-5 font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / CUSTOMER BILLING</div>
          <h1 className="mt-2 text-3xl font-semibold">Refund &amp; Cancellation Policy</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Effective November 18, 2026. This policy applies to MacroLync research subscriptions and AlgoLync software subscriptions purchased directly from FiduLync.</p>
        </header>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5">
            <h2 className="font-semibold text-white">1. What your payment covers</h2>
            <p className="mt-2">Payments to FiduLync are solely for access to our own digital research services, software licences and disclosed account-seat entitlements. They are not deposits to a broker or trading account. FiduLync does not receive, hold, manage or transfer customer trading capital. Customers deposit and withdraw trading funds directly with their chosen brokers.</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5">
            <h2 className="font-semibold text-white">2. Recurring subscriptions and cancellation</h2>
            <p className="mt-2">Monthly subscriptions renew monthly and annual subscriptions renew annually through Paystack using the customer's payment authorization. The checkout page displays the price, billing interval and included seats before payment. Annual pricing is ten monthly payments, equivalent to two months free.</p>
            <p className="mt-2">Customers may request cancellation through the subscription-management link or by contacting support. Cancellation stops future renewals. Access normally continues until the end of the paid billing period, subject to the applicable licence terms, payment status and any disclosed grace period. Cancelling a subscription does not automatically refund a billing period already started.</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5">
            <h2 className="font-semibold text-white">3. When a refund may be considered</h2>
            <p className="mt-2">We will investigate and, where appropriate, correct or refund:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>duplicate charges for the same order or billing period;</li>
              <li>an amount charged incorrectly compared with the checkout confirmation;</li>
              <li>a confirmed payment for which the purchased digital entitlement was not delivered and cannot reasonably be restored;</li>
              <li>a material service-access failure attributable to FiduLync that remains unresolved after we have had a reasonable opportunity to correct it; or</li>
              <li>any other circumstance where a refund is required by applicable law or Paystack's applicable rules.</li>
            </ul>
            <p className="mt-2">Refund requests are reviewed individually against payment records, entitlement logs and delivery status. Where a refund is approved, it is returned through the original payment channel where supported by the payment provider.</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5">
            <h2 className="font-semibold text-white">4. Digital licences, downloads and demo trials</h2>
            <p className="mt-2">Because digital software access and licence keys may be delivered immediately, a change of mind, trading loss, strategy performance, broker execution result, VPS failure or incompatibility caused by a customer's environment does not by itself qualify for a refund. This does not limit rights that cannot legally be excluded.</p>
            <p className="mt-2">Free demo trials are time-limited, are restricted to eligible MT5 demo accounts and do not automatically convert into paid subscriptions. Demo access does not promise trading results or guarantee compatibility with every broker or terminal configuration.</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5">
            <h2 className="font-semibold text-white">5. How to request help</h2>
            <p className="mt-2">Email <a className="text-emerald-300 underline underline-offset-4" href="mailto:fidulync@gmail.com">fidulync@gmail.com</a> from the email address used at checkout. Include the Paystack transaction reference, product name, charge date and a short explanation. Never send your card PIN, password, OTP or full card details.</p>
            <p className="mt-2">We aim to acknowledge billing enquiries within two business days and provide an outcome as soon as the payment provider and relevant records allow.</p>
          </section>
          <p className="text-xs leading-5 text-slate-500">This policy describes FiduLync's customer billing process and does not constitute financial or legal advice. Nothing here removes any consumer rights that apply under relevant law.</p>
        </div>
      </div>
    </main>
  );
}
