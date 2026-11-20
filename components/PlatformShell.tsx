'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandGlyph, { type BrandGlyphName } from '@/components/BrandGlyph';
import PlatformFooter from '@/components/PlatformFooter';

const links = [
  { href: '/', label: 'Macro Terminal', icon: 'shield' },
  { href: '/risk', label: 'Risk Planner', icon: 'gauge' },
  { href: '/research', label: 'Quant Research', icon: 'chart' },
  { href: '/research/validation', label: 'Strategy Validation', icon: 'activity' },
  { href: '/analytics', label: 'Cross-Asset & Performance', icon: 'radio' },
  { href: '/research/notebook', label: 'Research Notebook', icon: 'book' },
  { href: '/faq', label: 'Help', icon: 'activity' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

const mobileLinks = [
  { href: '/', label: 'Terminal', icon: 'shield' },
  { href: '/risk', label: 'Risk', icon: 'gauge' },
  { href: '/research', label: 'Research', icon: 'chart' },
  { href: '/research/validation', label: 'Validate', icon: 'activity' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="FiduLync quantitative research terminal">
            <span className="brand-mark"><BrandGlyph name="shield" size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy">
              <span className="brand-name">Fidu<span>Lync</span></span>
              <span className="brand-caption">PRIVATE QUANT RESEARCH TERMINAL</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
                className={`nav-link ${pathname === href ? 'nav-link-active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="topbar-actions">
            <Link className="secure-pill" href="/research/validation">
              <span className="secure-dot" /> Strategy Lab
            </Link>
            <button
              type="button"
              className="menu-toggle"
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
              aria-controls="fidulync-mobile-navigation"
              onClick={() => setDrawerOpen(!drawerOpen)}
            >
              <BrandGlyph name={drawerOpen ? 'close' : 'menu'} size={21} />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <nav
            id="fidulync-mobile-navigation"
            className="mobile-drawer"
            aria-label="Mobile navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <span className="eyebrow">FIDULYNC RESEARCH WORKSPACE</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
              >
                <BrandGlyph name="close" size={18} />
              </button>
            </div>
            {links.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                aria-current={pathname === href ? 'page' : undefined}
                className={`drawer-link ${pathname === href ? 'drawer-link-active' : ''}`}
              >
                <BrandGlyph name={icon} size={18} /> {label}
                <BrandGlyph name="arrow-up-right" size={15} className="drawer-arrow" />
              </Link>
            ))}
            <div className="drawer-footer">Private single-operator quantitative research environment</div>
          </nav>
        </div>
      )}

      <main className="page-frame">{children}</main>

      <PlatformFooter />

      <nav className="mobile-tabbar" aria-label="Primary mobile navigation">
        {mobileLinks.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className={`tab-link ${pathname === href ? 'tab-link-active' : ''}`}
          >
            <BrandGlyph name={icon} size={19} strokeWidth={pathname === href ? 2.2 : 1.7} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
