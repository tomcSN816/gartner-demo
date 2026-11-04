'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RESELLERS, RESELLER_COOKIE } from '@/lib/resellers';

// Dummy login: any credentials work; picking a reseller just sets a cookie.
export default function LoginForm() {
  const router = useRouter();
  const [selected, setSelected] = useState(RESELLERS[0].id);
  const reseller = RESELLERS.find((r) => r.id === selected);

  const onSubmit = (e) => {
    e.preventDefault();
    document.cookie = `${RESELLER_COOKIE}=${selected}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    router.push('/catalog');
    router.refresh();
  };

  return (
    <form className="login-card" onSubmit={onSubmit} style={reseller.theme}>
      <h1>Sign in</h1>
      <p className="login-sub">Choose your reseller portal.</p>

      <div className="reseller-grid" role="radiogroup" aria-label="Reseller">
        {RESELLERS.map((r) => (
          <button
            type="button"
            key={r.id}
            role="radio"
            aria-checked={selected === r.id}
            className={`reseller-option${selected === r.id ? ' selected' : ''}`}
            style={r.theme}
            onClick={() => setSelected(r.id)}
          >
            <span className="reseller-logo">{r.initials}</span>
            <span className="reseller-name">{r.name}</span>
            <span className="reseller-tagline">{r.tagline}</span>
          </button>
        ))}
      </div>

      <label className="login-field">
        Email
        <input type="email" defaultValue={`buyer@${selected}.example.com`} />
      </label>
      <label className="login-field">
        Password
        <input type="password" defaultValue="password" />
      </label>

      <button type="submit" className="login-submit">
        Sign in to {reseller.name}
      </button>
    </form>
  );
}
