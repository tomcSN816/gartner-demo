'use client';

import useCart from '@/hooks/useCart';

export default function CartBadge() {
  const { lines } = useCart();
  // Count products (top-level lines), not every child line beneath them.
  const count = lines.filter((l) => !l.parent_line_item).length;
  if (!count) return null;
  return <span className="cart-badge">{count}</span>;
}
