import EscrowForm from './EscrowForm';

export default function EscrowGenerator() {
  return (
    <section className="space-y-5">
      <header>
        <div className="eyebrow">FIDULYNC ESCROW ENGINE</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create a protected deal</h1>
        <p className="mt-2 text-xs leading-6 text-slate-400">Set clear terms, disclose the fixed 1.5% platform fee and share the secure payment link.</p>
      </header>
      <EscrowForm />
    </section>
  );
}
