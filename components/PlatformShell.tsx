'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandGlyph, { type BrandGlyphName } from '@/components/BrandGlyph';
import PlatformFooter from '@/components/PlatformFooter';

const links = [
  { href: '/', label: 'MacroLync', icon: 'shield' },
  { href: '/risk', label: 'Risk Planner', icon: 'gauge' },
  { href: '/research', label: 'Quant Lab', icon: 'chart' },
  { href: '/owner', label: 'EA Fleet', icon: 'chart' },

  { href: '/analytics', label: 'Performance', icon: 'activity' },
  { href: '/faq', label: 'Help', icon: 'activity' },
  { href: '/terms', label: 'Risk & Data', icon: 'shield-alert' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

const mobileLinks = [
  { href: '/', label: 'Terminal', icon: 'shield' },
  { href: '/risk', label: 'Risk', icon: 'gauge' },
  { href: '/research', label: 'Quant Lab', icon: 'chart' },
  { href: '/owner', label: 'EA Fleet', icon: 'chart' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

const macroLinks = [
  { href: '#matrix', label: 'Macro matrix', icon: 'chart' },
  { href: '#bias', label: 'Pair bias', icon: 'gauge' },
  { href: '#catalysts', label: 'Catalysts', icon: 'calendar' },
  { href: '#positioning', label: 'Positioning', icon: 'radio' },
  { href: '/risk', label: 'Risk planner', icon: 'gauge' },
  { href: '/research', label: 'Quant Lab', icon: 'chart' },
  { href: '/owner', label: 'EA Fleet', icon: 'chart' },
  { href: '/analytics', label: 'Performance', icon: 'activity' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isHome = pathname === '/';
  const navigation = isHome ? macroLinks : links;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/" aria-label="MacroLync terminal">
            <span className="brand-mark"><BrandGlyph name="shield" size={19} strokeWidth={2.2} /></span>
            <span className="brand-copy">
              <span className="brand-name">Macro<span>Lync</span></span>
              <span className="brand-caption">PERSONAL QUANT TERMINAL</span>
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
            <Link className="secure-pill" href={isHome ? '/owner' : '/' }>
              <span className="secure-dot" /> {isHome ? 'EA Fleet' : 'Macro terminal'}
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
              <span className="eyebrow">{isHome ? 'MACROLYNC' : 'FIDULYNC NAVIGATION'}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
              >
                <BrandGlyph name="close" size={18} />
              </button>
            </div>
            {navigation.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`drawer-link ${pathname === href ? 'drawer-link-active' : ''}`}
              >
                <BrandGlyph name={icon} size={18} /> {label} <BrandGlyph name="arrow-up-right" size={15} className="drawer-arrow" />
              </Link>
            ))}
            <div className="drawer-footer">Single-operator quantitative trading terminal</div>
          </nav>
        </div>
      )}

      <main className="page-frame">{children}</main>

      <PlatformFooter />

      {!isHome && (
        <nav className="mobile-tabbar" aria-label="Bottom navigation">
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
      )}
    </>
  );
}
