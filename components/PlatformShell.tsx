'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Gauge,
  Menu,
  Radio,
  Shield,
  X,
} from 'lucide-react';

const links = [
  { href: '/', label: 'MacroLync', icon: Shield },
  { href: '/store', label: 'AlgoLync Vault', icon: ChartNoAxesCombined },
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
  const navigation = isHome
    ? [...macroLinks, { href: '/store', label: 'AlgoLync Vault', icon: ChartNoAxesCombined }]
    : links;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="MacroLync terminal">
            <span className="brand-mark"><Shield size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy">
              <span className="brand-name">Macro<span>Lync</span></span>
              <span className="brand-caption">INSTITUTIONAL FX TERMINAL</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            {navigation.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${href.startsWith('#') ? '' : pathname === href ? 'nav-link-active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="topbar-actions">
            <Link className="secure-pill" href={isHome ? '/store' : '/'}>
              <span className="secure-dot" /> {isHome ? 'AlgoLync Vault' : 'Macro terminal'}
            </Link>
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
              <span className="eyebrow">{isHome ? 'MACROLYNC' : 'ALGOLYNC VAULT'}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`drawer-link ${pathname === href ? 'drawer-link-active' : ''}`}
              >
                <Icon size={18} /> {label} <ArrowUpRight size={15} className="drawer-arrow" />
              </Link>
            ))}
            <div className="drawer-footer">Single-operator quantitative trading terminal</div>
          </nav>
        </div>
      )}

      <main className="page-frame">{children}</main>

      {!isHome && (
        <nav className="mobile-tabbar" aria-label="Bottom navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={`tab-link ${pathname === href ? 'tab-link-active' : ''}`}
            >
              <Icon size={19} strokeWidth={pathname === href ? 2.2 : 1.7} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
