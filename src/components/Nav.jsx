'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RESELLER_COOKIE } from '@/lib/resellers';
import CartBadge from '@/components/CartBadge';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/guided-selling', label: 'Guided selling' },
  { href: '/orders', label: 'Orders' },
  { href: '/contracts', label: 'Contracts' },
];

export default function Nav({ reseller }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = () => {
    document.cookie = `${RESELLER_COOKIE}=; path=/; max-age=0`;
    setOpen(false);
    router.push('/login');
    router.refresh();
  };

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
          {reseller && <span className="nav-logo">{reseller.initials}</span>}
          {reseller ? reseller.name : 'Ordering Portal'}
        </Link>
        {reseller && (
          <>
            <button
              className="nav-toggle"
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? '✕' : '☰'}
            </button>
            <nav className={`nav-links${open ? ' open' : ''}`}>
              {LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={isActive(href) ? 'active' : ''}
                  aria-current={isActive(href) ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <button type="button" className="nav-signout" onClick={signOut}>
                Switch reseller
              </button>
              <Link
                href="/cart"
                className={`nav-icon nav-cart${isActive('/cart') ? ' active' : ''}`}
                aria-label="Cart"
                aria-current={isActive('/cart') ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="20" r="1.4" />
                  <circle cx="18" cy="20" r="1.4" />
                  <path d="M2.5 3h3l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L21 7H6.2" />
                </svg>
                <CartBadge />
              </Link>
              <Link
                href="/account"
                className={`nav-icon${isActive('/account') ? ' active' : ''}`}
                aria-label="Account"
                aria-current={isActive('/account') ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                </svg>
              </Link>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
