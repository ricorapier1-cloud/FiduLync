'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandGlyph, { type BrandGlyphName } from '@/components/BrandGlyph';
import WhatsAppSupportButton from '@/components/WhatsAppSupportButton';
import PlatformFooter from '@/components/PlatformFooter';

const links = [
  { href: '/', label: 'MacroLync', icon: 'shield' },
  { href: '/risk', label: 'Risk Planner', icon: 'gauge' },
  { href: '/research', label: 'Quant Lab', icon: 'chart' },
  { href: '/store', label: 'AlgoLync Store', icon: 'chart' },
  { href: '/customer', label: 'Customer Portal', icon: 'mail' },
  { href: '/analytics', label: 'Performance', icon: 'activity' },
  { href: '/faq', label: 'Help', icon: 'activity' },
  { href: '/terms', label: 'Risk & Data', icon: 'shield-alert' },
  { href: '/owner', label: 'Owner Console', icon: 'shield' },
] as const satisfies readonly { href: string; label: string; icon: BrandGlyphName }[];

const macroLinks = [
  { href: '#matrix', label: 'Macro matrix', icon: 'chart' },
  { href: '#bias', label: 'Pair bias', icon: 'gauge' },
  { href: '#catalysts', label: 'Catalysts', icon: 'calendar' },
  { href: '#positioning', label: 'Positioning', icon: 'radio' },
  { href: '/risk', label: 'Risk planner', icon: 'gauge' },
  { href: '/research', label: 'Quant Lab', icon: 'chart' },
  { href: '/store', label: 'AlgoLync Store', icon: 'chart' },
  { href: '/analytics', label: 'Performance', icon: 'activity' },
  { href: '/owner', label: 'Owner Console', icon: 'shield' },
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
            <a
              href="https://wa.me/2348037212445?text=Hello%2C%20I%20need%20help%20with%20my%20FiduLync%20Personal%20Quant%20workspace"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 h-11 w-11 justify-center p-0 font-mono text-[10px] text-emerald-300 transition hover:bg-emerald-400/20"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 
            </a>
            <Link className="secure-pill" href={isHome ? '/store' : '/' }>
              <span className="secure-dot" /> {isHome ? 'EA Lab' : 'Macro terminal'}
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
              <span className="eyebrow">{isHome ? 'MACROLYNC' : 'PERSONAL EA LAB'}</span>
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
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <a
                href="https://wa.me/2348037212445?text=Hello%2C%20I%20need%20help%20with%20my%20FiduLync%20Personal%20Quant%20workspace"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-400 py-2.5 font-mono text-xs font-semibold text-[#07120d]"
              >
                : +234 803 721 2445
              </a>
            </div>
            <div className="drawer-footer">Single-operator quantitative trading terminal</div>
          </nav>
        </div>
      )}

      <main className="page-frame">{children}</main>

      <PlatformFooter />
      <WhatsAppSupportButton />

      {!isHome && (
        <nav className="mobile-tabbar" aria-label="Bottom navigation">
          {links.map(({ href, label, icon }) => (
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
