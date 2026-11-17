'use client';

import Link from 'next/link';
import { useState } from 'react';
import useCart from '@/hooks/useCart';
import { removeQuoteTree } from '@/lib/servicenow';
import { notifyCartChanged } from '@/lib/cartEvents';

const money = (v) => v || '$0.00';

const num = (v) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// Orders lines parent-first with their children beneath, and records the depth
// so the product column can be indented. parent_line_item holds the parent's number.
function nest(lines) {
  const kids = new Map();
  lines.forEach((l) => {
    const k = l.parent_line_item || '';
    kids.set(k, [...(kids.get(k) || []), l]);
  });
  const out = [];
  const walk = (parent, depth) =>
    (kids.get(parent) || []).forEach((l) => {
      out.push({ ...l, depth });
      walk(l.number, depth + 1);
    });
  walk('', 0);
  // Anything whose parent isn't in the list still shows, at the top level.
  lines.filter((l) => !out.some((o) => o.sys_id === l.sys_id)).forEach((l) => out.push({ ...l, depth: 0 }));
  return out;
}

const COLS = ['24%', '8%', '13%', '13%', '13%', '13%', '240px'];
const Cols = () => (
  <colgroup>
    {COLS.map((w, i) => <col key={i} style={{ width: w }} />)}
  </colgroup>
);

// Splits the flat, ordered list into one group per top-level line.
function groups(lines) {
  const out = [];
  nest(lines).forEach((l) => {
    if (l.depth === 0) out.push([l]);
    else out[out.length - 1]?.push(l);
  });
  return out;
}

export default function CartView() {
  const { cart, lines, loading, error } = useCart();
  const [busy, setBusy] = useState('');
  const [removeError, setRemoveError] = useState('');

  const remove = async (root) => {
    if (!window.confirm(`Remove ${root.product_offering || root.number} and everything under it?`)) return;
    setBusy(root.sys_id);
    setRemoveError('');
    try {
      await removeQuoteTree(root.sys_id);
      notifyCartChanged();
    } catch (e) {
      setRemoveError(String(e.message ?? e));
    } finally {
      setBusy('');
    }
  };

  if (loading) return <p>Loading cart…</p>;
  if (error) return <div className="embed-empty">Couldn’t load the cart: {error}</div>;
  if (!cart) return <p>Your cart is empty. Add something from the catalog.</p>;

  return (
    <>
      {removeError && <div className="embed-empty">{removeError}</div>}
      {lines.length === 0 && <p className="muted">No line items.</p>}

      {groups(lines).map(([root, ...children]) => (
        <section key={root.sys_id} className="cart-group">
          <table className="table cart-table">
            <Cols />
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Monthly</th>
                <th className="num">Annual</th>
                <th className="num">Net total</th>
                <th className="act"></th>
              </tr>
            </thead>
            <tbody>
              {[root, ...children].map((l) => (
                <tr key={l.sys_id} className={l.depth === 0 ? 'cart-root' : undefined}>
                  <td style={{ paddingLeft: `${0.9 + l.depth * 1.25}rem` }}>
                    {l.depth > 0 && <span className="muted">↳ </span>}
                    {l.product_offering || l.number}
                  </td>
                  <td className="num">{l.quantity}</td>
                  <td className="num">{money(l.unit_base_price)}</td>
                  <td className="num">{money(l.monthly_recurring_price)}</td>
                  <td className="num">{money(l.annual_recurring_price)}</td>
                  <td className="num">{money(l.cumulative_net_price)}</td>
                  <td className="act">
                    {l.depth === 0 && (
                      <>
                        <Link
                          className="btn"
                          href={`/catalog?quoteLine=${l.sys_id}&label=${encodeURIComponent(l.product_offering || l.number)}`}
                        >
                          Reconfigure
                        </Link>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busy === l.sys_id}
                          onClick={() => remove(l)}
                        >
                          {busy === l.sys_id ? 'Removing…' : 'Remove'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <table className="table cart-table cart-total">
        <Cols />
        <tbody>
          <tr>
            <td colSpan={3}>
              Total
              {num(cart.total_one_time_price) > 0 && (
                <span className="muted"> · one-time {usd(num(cart.total_one_time_price))}</span>
              )}
            </td>
            <td className="num">{usd(num(cart.total_monthly_recurring_price_v2))}</td>
            <td className="num">{usd(num(cart.total_annual_recurring_price_v2))}</td>
            <td className="num">{usd(num(cart.total_amount))}</td>
            <td className="act"></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
