import EscrowForm from '@/app/components/EscrowForm';

export default function CreateLink() {
  return (
    <div className="page-content">
      <header className="page-heading">
        <div>
          <div className="eyebrow">FIDULYNC ESCROW ENGINE</div>
          <h1>Create a protected deal</h1>
          <p>Define clear delivery terms, disclose the 1.5% fee allocation and create a secure link for your buyer.</p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2 text-[10px] text-emerald-100 sm:inline-flex">
          <span className="status-dot" /> Payment partner · Paystack
        </span>
      </header>
      <EscrowForm />
    </div>
  );
}
