'use client';

import useCart from '@/hooks/useCart';

const money = (v) => v || '$0.00';

export default function CartView() {
  const { cart, lines, loading, error } = useCart();

  if (loading) return <p>Loading cart…</p>;
  if (error) return <div className="embed-empty">Couldn’t load the cart: {error}</div>;
  if (!cart) return <p>Your cart is empty. Add something from the catalog.</p>;

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Monthly</th>
            <th className="num">Annual</th>
            <th className="num">Net total</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={6} className="muted">No line items.</td></tr>
          )}
          {lines.map((l) => (
            <tr key={l.sys_id}>
              <td>{l.product_offering || l.number}</td>
              <td className="num">{l.quantity}</td>
              <td className="num">{money(l.unit_base_price)}</td>
              <td className="num">{money(l.monthly_recurring_price)}</td>
              <td className="num">{money(l.annual_recurring_price)}</td>
              <td className="num">{money(l.cumulative_net_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card totals">
        <div><span className="muted">One-time</span> {money(cart.total_one_time_price)}</div>
        <div><span className="muted">Monthly</span> {money(cart.total_monthly_recurring_price)}</div>
        <div><span className="muted">Annual</span> {money(cart.total_annual_recurring_price)}</div>
        <div><span className="muted">Total</span> <strong>{money(cart.total_amount)}</strong></div>
      </div>
    </>
  );
}
