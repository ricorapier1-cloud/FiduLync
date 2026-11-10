'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Gauge,
  Menu,
  Radio,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';

const links = [
  { href: '/', label: 'Overview', icon: Shield },
  { href: '/create-link', label: 'Create escrow', icon: ShieldCheck },
  { href: '/store', label: 'AlgoLync', icon: ChartNoAxesCombined },
  { href: '/dashboard', label: 'Activity', icon: ArrowUpRight },
];

const macroLinks = [
  { href: '#matrix', label: 'Macro matrix', icon: ChartNoAxesCombined },
  { href: '#bias', label: 'Pair bias', icon: Gauge },
  { href: '#catalysts', label: 'Catalysts', icon: CalendarDays },
  { href: '#positioning', label: 'Positioning', icon: Radio },
];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHome = pathname === '/';
  const drawerLinks = isHome ? macroLinks : links;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label={isHome ? 'MacroLync home' : 'FiduLync home'}>
            <span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy">
              <span className="brand-name">{isHome ? 'Macro' : 'Fidu'}<span>Lync</span></span>
              <span className="brand-caption">{isHome ? 'GLOBAL FX INTELLIGENCE' : 'TRUST, SETTLED.'}</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            {(isHome ? macroLinks : links).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${!isHome && pathname === href ? 'nav-link-active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="topbar-actions">
            {!isHome && (
              <Link className="back-link" href="/">
                <ArrowLeft size={15} /> <span>Back</span>
              </Link>
            )}
            {isHome ? (
              <a className="secure-pill portfolio-nav-cta" href="#vip">VIP Macro Pass <ArrowUpRight size={14} /></a>
            ) : (
              <Link className="secure-pill" href="/create-link">
                <span className="secure-dot" /> New transaction
              </Link>
            )}
            <button
              type="button"
              className="menu-toggle"
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              {drawerOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <nav
            className="mobile-drawer"
            aria-label="Mobile navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <span className="eyebrow">{isHome ? 'MACROLYNC' : 'PLATFORM'}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {drawerLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`drawer-link ${pathname === href ? 'drawer-link-active' : ''}`}
              >
                <Icon size={18} /> {label} <ArrowUpRight size={15} className="drawer-arrow" />
              </Link>
            ))}
            <div className="drawer-footer">{isHome ? 'Global FX macro intelligence' : 'Institutional transaction infrastructure'}</div>
          </nav>
        </div>
      )}

      <main className="page-frame">{children}</main>

      {!isHome && (
        <nav className="mobile-tabbar" aria-label="Bottom navigation">
          {links.slice(0, 4).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={`tab-link ${pathname === href ? 'tab-link-active' : ''}`}
            >
              <Icon size={19} strokeWidth={pathname === href ? 2.2 : 1.7} />
              <span>{label === 'Create escrow' ? 'Create' : label === 'Activity' ? 'Activity' : label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
