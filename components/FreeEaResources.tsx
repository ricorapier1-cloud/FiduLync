const resources = [
  {
    name: 'MacroLync G10 ATR Breakout',
    type: 'FiduLync open-source sandbox',
    description: 'Our own educational MQL5 source EA for testing ATR-based breakout logic. Source only; not a compiled EX5 binary.',
    href: '/downloads/MacroLync_G10_Breakout_Test.mq5',
    label: 'Download .mq5 source',
    internal: true,
  },
  {
    name: 'Easy Range Breakout EA',
    type: 'MQL5 CodeBase · external community source',
    description: 'A free MT5 range-breakout example published by its original author. Review the source and test it independently before use.',
    href: 'https://www.mql5.com/en/code/68764',
    label: 'Open MQL5 source page',
    internal: false,
  },
  {
    name: 'ADX Trend Pullback EA',
    type: 'MQL5 CodeBase · external community source',
    description: 'A free ADX, EMA-pullback and ATR example published by its original author. Not compiled, audited or endorsed by FiduLync.',
    href: 'https://www.mql5.com/en/code/73958',
    label: 'Open MQL5 source page',
    internal: false,
  },
];

export default function FreeEaResources() {
  return (
    <section className="mt-10" aria-labelledby="free-ea-lab-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="font-mono text-[9px] tracking-[0.18em] text-sky-300">OPEN-SOURCE / COMMUNITY</div>
          <h2 id="free-ea-lab-heading" className="mt-2 text-xl font-semibold text-white">Free MT5 test lab</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Download source code or visit the original MQL5 CodeBase publisher. These are separate from paid AlgoLync subscriptions and do not require a paid licence.</p>
        </div>
        <a href="https://www.mql5.com/en/code/mt5/experts" target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-300 underline underline-offset-4">Browse all free MT5 EAs</a>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {resources.map((item) => (
          <article key={item.name} className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-4 sm:p-5">
            <div className="font-mono text-[9px] tracking-wide text-sky-300">{item.type}</div>
            <h3 className="mt-2 text-sm font-semibold text-white">{item.name}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
            <a href={item.href} {...(!item.internal ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true })} className="mt-4 inline-flex rounded-lg border border-sky-400/30 px-3 py-2 text-[10px] font-semibold text-sky-200 hover:bg-sky-400/10">{item.label}</a>
          </article>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-5 text-slate-500">Important: MQL5 source files require MetaEditor on a computer to compile into .ex5. These community downloads remain on their original publisher pages. FiduLync has not independently verified their performance or safety.</p>
    </section>
  );
}
