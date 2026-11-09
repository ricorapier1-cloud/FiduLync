'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  Menu,
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

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHome = pathname === '/';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="FiduLync home">
            <span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy">
              <span className="brand-name">fidu<span>lync</span></span>
              <span className="brand-caption">TRUST, SETTLED.</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${pathname === href ? 'nav-link-active' : ''}`}
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
            <Link className="secure-pill" href="/create-link">
              <span className="secure-dot" /> New transaction
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
              <span className="eyebrow">PLATFORM</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`drawer-link ${pathname === href ? 'drawer-link-active' : ''}`}
              >
                <Icon size={18} /> {label} <ArrowUpRight size={15} className="drawer-arrow" />
              </Link>
            ))}
            <div className="drawer-footer">Institutional transaction infrastructure</div>
          </nav>
        </div>
      )}

      <main className="page-frame">{children}</main>

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
    </>
  );
}
