'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandGlyph, { type BrandGlyphName } from '@/components/BrandGlyph';
import PlatformFooter from '@/components/PlatformFooter';

const navigationLinks = [
  { href: '/', label: 'Macro Terminal', icon: 'shield' },
  { href: '/#matrix', label: 'Policy Matrix', icon: 'chart' },
  { href: '/#bias', label: 'Pair Bias', icon: 'gauge' },
  { href: '/#catalysts', label: 'Catalysts', icon: 'calendar' },
  { href: '/#regimes', label: 'Cross-Asset', icon: 'radio' },
  { href: '/notebook', label: 'Trade Journal', icon: 'activity' },
  { href: '/workbench', label: 'Validation Workbench', icon: 'trend' },
  { href: '/faq', label: 'FAQ', icon: 'shield-alert' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHome = pathname === '/';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="MacroLync terminal">
            <span className="brand-mark"><BrandGlyph name="shield" size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy">
              <span className="brand-name">Macro<span>Lync</span></span>
              <span className="brand-caption">INSTITUTIONAL MACRO INTELLIGENCE</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            {navigationLinks.map(({ href, label }) => {
              const isActive = href === '/' ? pathname === '/' : pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="topbar-actions">
            <Link className="secure-pill" href="/notebook">
              <span className="secure-dot" /> Trade Journal
            </Link>
            <button
              type="button"
              className="menu-toggle"
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
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
            className="mobile-drawer"
            aria-label="Mobile navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <span className="eyebrow">MACROLYNC TERMINAL</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
              >
                <BrandGlyph name="close" size={18} />
              </button>
            </div>
            {navigationLinks.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`drawer-link ${pathname === href ? 'drawer-link-active' : ''}`}
              >
                <BrandGlyph name={icon} size={18} /> {label} <BrandGlyph name="arrow-up-right" size={15} className="drawer-arrow" />
              </Link>
            ))}
            <div className="drawer-footer">Institutional Macro &amp; Fundamental Intelligence Center</div>
          </nav>
        </div>
      )}

      {!isHome && (
        <div className="inner-back-bar" role="navigation" aria-label="Page navigation">
          <div className="inner-back-bar-content">
            <Link href="/" className="back-button" aria-label="Return to Macro Terminal">
              <BrandGlyph name="arrow-left" size={15} strokeWidth={2.2} />
              <span>Back to Terminal</span>
            </Link>
            <div className="breadcrumb-path">
              <Link href="/" className="breadcrumb-root">Terminal</Link>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {pathname === '/notebook' ? 'Trade Journal' :
                 pathname === '/workbench' ? 'Validation Workbench' :
                 pathname === '/faq' ? 'FAQ & Methodology' :
                 pathname === '/privacy' ? 'Privacy Policy' :
                 pathname === '/terms' ? 'Terms & Disclosures' : 'Workspace'}
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="page-frame">{children}</main>

      <PlatformFooter />

      {!isHome && (
        <nav className="mobile-tabbar" aria-label="Bottom navigation">
          {navigationLinks.slice(0, 4).map(({ href, label, icon }) => (
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
      )}
    </>
  );
}
