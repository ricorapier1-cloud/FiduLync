import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Braces,
  ChartNoAxesCombined,
  ChevronRight,
  CircleCheck,
  Code2,
  LockKeyhole,
  MessageCircle,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import MarketTicker from '@/app/components/MarketTicker';
import PortfolioInquiryForm from '@/app/components/PortfolioInquiryForm';

const pipeline = [
  { index: '01', title: 'Market signal', detail: 'Strategy rules and data inputs', icon: ChartNoAxesCombined },
  { index: '02', title: 'Risk & drawdown engine', detail: 'Daily limits and prop-firm rules', icon: ShieldAlert },
  { index: '03', title: 'Execution bridge', detail: 'Order routing and safeguards', icon: Workflow },
  { index: '04', title: 'Broker VPS', detail: 'Resilient, low-latency deployment', icon: Blocks },
];

const services = [
  {
    index: '01',
    title: 'Custom MT5 EA development',
    detail: 'Strategy automation, backtesting workflows, and explicit prop-firm risk rules built around your operating brief.',
    tags: ['MQL5', 'Risk controls', 'Strategy systems'],
    icon: ChartNoAxesCombined,
  },
  {
    index: '02',
    title: 'High-security fintech applications',
    detail: 'Payment gateways, escrow settlement flows, and hardened webhook integrations for financial products.',
    tags: ['Payment rails', 'Escrow', 'Webhook security'],
    icon: LockKeyhole,
  },
  {
    index: '03',
    title: 'Code audits & execution optimization',
    detail: 'Targeted review for latency, slippage exposure, reliability issues, and production defects.',
    tags: ['Code audits', 'Latency', 'Reliability'],
    icon: Code2,
  },
];

export default function Home() {
  return (
    <div className="portfolio-page">
      <MarketTicker />

      <section className="portfolio-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span className="status-dot" /> INDEPENDENT SYSTEMS ENGINEERING</div>
          <h1 id="hero-title">Architecting high-yield MT5 quantitative systems <span>&</span> institutional fintech apps.</h1>
          <p className="hero-description">
            Trading infrastructure and financial products engineered for disciplined execution, resilient operations, and clear risk boundaries.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="https://wa.me/2348037212445?text=Hello%2C%20I%27d%20like%20to%20discuss%20a%20quant%20systems%20or%20fintech%20project." target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> Direct WhatsApp inquiry <ArrowUpRight size={15} />
            </a>
            <a className="secondary-button" href="#work">View case studies <ArrowDownRight size={15} /></a>
          </div>
          <div className="hero-proof mono">
            <span><CircleCheck size={14} /> Risk-first engineering</span>
            <span><CircleCheck size={14} /> Production-minded delivery</span>
          </div>
        </div>

        <div className="hero-terminal" aria-label="Systems overview">
          <div className="terminal-heading">
            <span className="terminal-mark"><Braces size={16} /></span>
            <div><span className="metric-label">SYSTEMS / OVERVIEW</span><strong>Execution, under control.</strong></div>
            <span className="terminal-live"><span className="status-dot" /> LIVE</span>
          </div>
          <div className="terminal-visual">
            <div className="terminal-grid" />
            <div className="terminal-path"><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="terminal-node terminal-node-one"><ChartNoAxesCombined size={17} /><span>SIGNAL</span></div>
            <div className="terminal-node terminal-node-two"><ShieldAlert size={17} /><span>RISK GATE</span></div>
            <div className="terminal-node terminal-node-three"><Workflow size={17} /><span>EXECUTION</span></div>
            <div className="terminal-foot mono"><span>ROUTE / MT5 → BROKER VPS</span><span>GUARDED</span></div>
          </div>
          <div className="terminal-stats mono">
            <div><span>CONTROL MODEL</span><strong>RULE-BASED</strong></div>
            <div><span>FAIL-SAFE</span><strong>ENABLED</strong></div>
            <div><span>DEPLOYMENT</span><strong>OBSERVABLE</strong></div>
          </div>
        </div>
      </section>

      <section id="architecture" className="portfolio-section architecture-section" aria-labelledby="architecture-title">
        <div className="section-heading">
          <div><span className="eyebrow">SYSTEM EXECUTION ARCHITECTURE</span><h2 id="architecture-title">A defined path from signal to broker.</h2></div>
          <span className="section-index mono">FLOW / 04 STAGES</span>
        </div>
        <div className="pipeline-grid">
          {pipeline.map(({ index, title, detail, icon: Icon }, position) => (
            <div className="pipeline-step" key={index}>
              <div className="pipeline-top"><span className="mono">{index}</span><Icon size={18} /></div>
              <h3>{title}</h3><p>{detail}</p>
              {position < pipeline.length - 1 && <ChevronRight className="pipeline-arrow" size={17} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      <section id="work" className="portfolio-section" aria-labelledby="work-title">
        <div className="section-heading">
          <div><span className="eyebrow">SELECTED SYSTEMS</span><h2 id="work-title">Built for consequential workflows.</h2></div>
          <span className="section-index mono">CASE FILES / 02</span>
        </div>
        <div className="case-grid">
          <article className="case-study case-study-fidulync">
            <div className="case-topline"><span className="case-icon"><LockKeyhole size={19} /></span><span className="case-type mono">FINTECH / SETTLEMENT</span><ArrowUpRight size={17} className="case-arrow" /></div>
            <h3>FiduLync</h3>
            <p>High-security escrow settlement infrastructure that coordinates payment events, delivery terms, and dispute resolution in one auditable flow.</p>
            <div className="case-architecture"><span>PAYSTACK WEBHOOKS</span><i /><span>SETTLEMENT ENGINE</span><i /><span>DISPUTE VAULT</span></div>
            <div className="case-tags"><span>Webhook verification</span><span>Escrow lifecycle</span><span>Dispute controls</span></div>
            <Link href="/create-link" className="case-link">Explore the platform <ArrowRight size={15} /></Link>
          </article>
          <article className="case-study case-study-algolync">
            <div className="case-topline"><span className="case-icon case-icon-cyan"><ChartNoAxesCombined size={19} /></span><span className="case-type mono">ALGORITHMIC / MT5</span><ArrowUpRight size={17} className="case-arrow" /></div>
            <h3>AlgoLync</h3>
            <p>Automated MQL5 trading systems designed around explicit daily drawdown defense and Z-score mean-reversion logic.</p>
            <div className="case-architecture case-architecture-cyan"><span>PRICE SERIES</span><i /><span>Z-SCORE SIGNAL</span><i /><span>RISK FILTER</span></div>
            <div className="case-tags"><span>MQL5 execution</span><span>Daily drawdown guard</span><span>Mean reversion</span></div>
            <Link href="/store" className="case-link case-link-cyan">Explore AlgoLync <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      <section id="services" className="portfolio-section services-section" aria-labelledby="services-title">
        <div className="section-heading">
          <div><span className="eyebrow">SERVICES & COMMERCIAL SCHEDULE</span><h2 id="services-title">Senior engineering, scoped to the brief.</h2></div>
          <span className="section-index mono">ENGAGEMENT / PROJECT-BASED</span>
        </div>
        <div className="services-grid">
          {services.map(({ index, title, detail, tags, icon: Icon }) => (
            <article className="service-item" key={index}>
              <div className="service-top"><span className="mono">{index}</span><Icon size={18} /></div>
              <h3>{title}</h3><p>{detail}</p>
              <div className="service-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="service-commercial"><span className="metric-label">COMMERCIAL MODEL</span><strong>Quoted by scope</strong></div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="portfolio-section inquiry-section" aria-labelledby="contact-title">
        <div className="inquiry-copy">
          <span className="eyebrow">START A CONVERSATION</span>
          <h2 id="contact-title">Bring the hard part. We’ll engineer the system.</h2>
          <p>Share the strategy, workflow, or production constraint you need solved. We’ll use your brief to start a focused conversation.</p>
          <a className="whatsapp-link" href="https://wa.me/2348037212445?text=Hello%2C%20I%27d%20like%20to%20discuss%20a%20quant%20systems%20or%20fintech%20project." target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} /> One-tap WhatsApp consultation <ArrowUpRight size={15} />
          </a>
          <span className="inquiry-note mono">DIRECT CONTACT / +234 803 721 2445</span>
        </div>
        <PortfolioInquiryForm />
      </section>

      <footer className="portfolio-footer">
        <Link className="footer-brand" href="/"><span className="brand-name">Fidu<span>Lync</span></span><span className="brand-caption">QUANT SYSTEMS ENGINEERING</span></Link>
        <span className="mono">SYSTEMS BUILT WITH INTENT / © {new Date().getFullYear()}</span>
        <Link href="/create-link" className="footer-platform">Open platform <ArrowUpRight size={14} /></Link>
      </footer>
    </div>
  );
}