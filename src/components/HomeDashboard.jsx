'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentCart, getCartLines, getContracts, getAccountOrders } from '@/lib/servicenow';
import { CART_CHANGED } from '@/lib/cartEvents';

const num = (v) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const DONE = /^(completed|cancel+ed|rejected|closed)/i;

function Stat({ href, label, value, note }) {
  return (
    <Link href={href} className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </Link>
  );
}

export default function HomeDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [cart, contracts, orders] = await Promise.all([
          getCurrentCart(),
          getContracts(),
          getAccountOrders(8),
        ]);
        const lines = cart ? await getCartLines(cart.sys_id) : [];
        if (alive) setData({ cart, lines, contracts, orders });
      } catch (e) {
        if (alive) setError(String(e.message ?? e));
      }
    };
    load();
    window.addEventListener(CART_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(CART_CHANGED, load);
    };
  }, []);

  if (error) return <div className="embed-empty">Couldn’t load your overview: {error}</div>;
  if (!data) return <p className="muted">Loading your overview…</p>;

  const { cart, lines, contracts, orders } = data;
  const products = lines.filter((l) => !l.parent_line_item);
  const active = contracts.filter((c) => /^active/i.test(c.state));
  const open = orders.filter((o) => !DONE.test(o.state));
  const ending = [...active].filter((c) => c.ends).sort((a, b) => String(a.ends).localeCompare(String(b.ends))).slice(0, 4);

  return (
    <>
      <div className="stat-grid">
        <Stat
          href="/cart"
          label="Cart"
          value={cart ? usd(num(cart.total_amount)) : '$0.00'}
          note={`${products.length} product${products.length === 1 ? '' : 's'} in your quote`}
        />
        <Stat
          href="/contracts"
          label="Active contracts"
          value={active.length}
          note={`${contracts.length} contract${contracts.length === 1 ? '' : 's'} in total`}
        />
        <Stat
          href="/orders"
          label="Orders in progress"
          value={open.length}
          note={orders[0] ? `Latest: ${orders[0].number} · ${orders[0].state}` : 'No orders yet'}
        />
      </div>

      <div className="home-grid">
        <section className="card">
          <h2>Recent orders</h2>
          {orders.length === 0 && <p className="muted">No orders yet.</p>}
          <table className="table mini-table">
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.sys_id}>
                  <td>{o.number}</td>
                  <td>{o.order_type}</td>
                  <td><span className="pill">{o.state}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/orders" className="more">All orders →</Link>
        </section>

        <section className="card">
          <h2>Contracts ending soonest</h2>
          {ending.length === 0 && <p className="muted">No active contracts.</p>}
          <table className="table mini-table">
            <tbody>
              {ending.map((c) => (
                <tr key={c.sys_id}>
                  <td>{c.number}</td>
                  <td>{c.short_description}</td>
                  <td className="num">{c.ends}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/contracts" className="more">All contracts →</Link>
        </section>
      </div>
    </>
  );
}
