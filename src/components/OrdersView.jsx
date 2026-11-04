'use client';

import { Fragment, useEffect, useState } from 'react';
import { getOrders, getOrderLines } from '@/lib/servicenow';

const money = (v) => v || '$0.00';

export default function OrdersView() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [lines, setLines] = useState({});

  useEffect(() => {
    getOrders().then(setOrders).catch((e) => setError(String(e.message ?? e)));
  }, []);

  async function toggle(order) {
    if (openId === order.sys_id) return setOpenId(null);
    setOpenId(order.sys_id);
    if (!lines[order.sys_id]) {
      try {
        const rows = await getOrderLines(order.sys_id);
        setLines((l) => ({ ...l, [order.sys_id]: rows }));
      } catch (e) {
        setError(String(e.message ?? e));
      }
    }
  }

  if (error) return <div className="embed-empty">Couldn’t load orders: {error}</div>;
  if (!orders) return <p>Loading orders…</p>;
  if (!orders.length) return <p>No orders yet.</p>;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Order</th>
          <th>State</th>
          <th>Contact</th>
          <th>Type</th>
          <th>Channel</th>
          <th className="num">One-time</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <Fragment key={o.sys_id}>
            <tr className="clickable" onClick={() => toggle(o)}>
              <td><strong>{o.number}</strong></td>
              <td><span className="pill">{o.state}</span></td>
              <td>{o.contact || '—'}</td>
              <td>{o.order_type}</td>
              <td>{o.channel}</td>
              <td className="num">{money(o.total_one_time_price)}</td>
              <td>{o.sys_created_on}</td>
            </tr>
            {openId === o.sys_id && (
              <tr>
                <td colSpan={7} className="subrow">
                  {!lines[o.sys_id] ? (
                    'Loading lines…'
                  ) : lines[o.sys_id].length === 0 ? (
                    'No line items.'
                  ) : (
                    <table className="table inner">
                      <tbody>
                        {lines[o.sys_id].map((l) => (
                          <tr key={l.sys_id}>
                            <td>{l.product_offering || l.number}</td>
                            <td className="num">Qty {l.quantity}</td>
                            <td>{l.action}</td>
                            <td><span className="pill">{l.state}</span></td>
                            <td className="num">{money(l.cumulative_net_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
