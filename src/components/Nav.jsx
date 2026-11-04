'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RESELLER_COOKIE } from '@/lib/resellers';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/cart', label: 'Cart' },
  { href: '/orders', label: 'Orders' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/account', label: 'Account' },
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
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
