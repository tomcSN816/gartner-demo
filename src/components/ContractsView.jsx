'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getContracts, getContractLines } from '@/lib/servicenow';

const money = (v) => v || '$0.00';

export default function ContractsView() {
  const router = useRouter();
  const [contracts, setContracts] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [lines, setLines] = useState({});

  useEffect(() => {
    getContracts().then(setContracts).catch((e) => setError(String(e.message ?? e)));
  }, []);

  async function toggle(contract) {
    if (openId === contract.sys_id) return setOpenId(null);
    setOpenId(contract.sys_id);
    if (!lines[contract.sys_id]) {
      try {
        const rows = await getContractLines(contract.sys_id);
        setLines((l) => ({ ...l, [contract.sys_id]: rows }));
      } catch (e) {
        setError(String(e.message ?? e));
      }
    }
  }

  // Amend = open the line's saved configuration as an amendment.
  function amend(line, contract) {
    const label = encodeURIComponent(`Amendment of ${line.number} · ${contract.number}`);
    router.push(`/catalog?amendLine=${line.sys_id}&label=${label}`);
  }

  if (error) return <div className="embed-empty">Couldn’t load contracts: {error}</div>;
  if (!contracts) return <p>Loading contracts…</p>;
  if (!contracts.length) return <p>No contracts for this account.</p>;

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Description</th>
            <th>State</th>
            <th>Starts</th>
            <th>Ends</th>
            <th>PO</th>
            <th className="num">Yearly</th>
            <th className="num">Total value</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <Fragment key={c.sys_id}>
              <tr className="clickable" onClick={() => toggle(c)}>
                <td><strong>{c.number}</strong></td>
                <td>{c.short_description}</td>
                <td><span className="pill">{c.state}</span></td>
                <td>{c.starts}</td>
                <td>{c.ends}</td>
                <td>{c.po_number || '—'}</td>
                <td className="num">{money(c.yearly_cost)}</td>
                <td className="num">{money(c.total_contract_value)}</td>
              </tr>
              {openId === c.sys_id && (
                <tr>
                  <td colSpan={8} className="subrow">
                    {!lines[c.sys_id] ? (
                      'Loading lines…'
                    ) : lines[c.sys_id].length === 0 ? (
                      'No contract lines.'
                    ) : (
                      <table className="table inner">
                        <tbody>
                          {lines[c.sys_id].map((l) => (
                            <tr key={l.sys_id}>
                              <td>{l.name}</td>
                              <td className="num">Qty {l.quantity}</td>
                              <td><span className="pill">{l.state}</span></td>
                              <td>{l.starts || '—'} → {l.ends || '—'}</td>
                              <td className="num">{money(l.annual_recurring_price)}</td>
                              <td className="num">
                                {l.isTopLine && (
                                  <button className="btn" onClick={() => amend(l, c)}>Amend</button>
                                )}
                              </td>
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
    </>
  );
}
