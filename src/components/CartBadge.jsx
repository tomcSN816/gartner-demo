'use client';

import useCart from '@/hooks/useCart';

export default function CartBadge() {
  const { lines } = useCart();
  if (!lines.length) return null;
  return <span className="cart-badge">{lines.length}</span>;
}
