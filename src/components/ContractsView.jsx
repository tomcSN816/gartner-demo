'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getContracts, getContractLines, terminateContract, todayIso } from '@/lib/servicenow';

const money = (v) => v || '$0.00';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ContractsView() {
  const router = useRouter();
  const [contracts, setContracts] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [lines, setLines] = useState({});
  // { id, step } while a terminate is running; termMsg is { id, kind, text } after one finishes.
  const [terminating, setTerminating] = useState(null);
  const [termMsg, setTermMsg] = useState(null);
  // The open Terminate form: { id, line, date, reason, min, max }.
  const [form, setForm] = useState(null);

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

  // Terminate opens a small form (effective date + reason) under the contract row.
  function startTerminate(line, contract) {
    const range = [contract.starts, contract.ends].map((d) => (ISO_DATE.test(d ?? '') ? d : ''));
    let date = todayIso();
    if (range[0] && date < range[0]) date = range[0];
    if (range[1] && date > range[1]) date = range[1];
    setTermMsg(null);
    setForm({ id: contract.sys_id, line, date, reason: 'Terminated from the portal', min: range[0], max: range[1] });
  }

  // Terminate = disconnect the whole contract through a disconnect order. The platform
  // then cancels the contract and all its lines, which we re-read and show.
  async function terminate(contract) {
    const { line, date, reason } = form;
    const id = contract.sys_id;
    setForm(null);
    setTermMsg(null);
    setTerminating({ id, step: 'Starting…' });
    try {
      const result = await terminateContract({
        contractId: id,
        rootSoldProductId: line.soldProductId,
        reason: reason.trim(),
        effectiveDate: date,
        onProgress: (step) => setTerminating({ id, step }),
      });
      setLines((l) => ({ ...l, [id]: result.lines }));
      getContracts().then(setContracts).catch(() => {});
      setTermMsg({
        id,
        kind: result.settled ? 'ok' : 'warn',
        text: result.settled
          ? `${contract.number} terminated (order ${result.orderNumber}). All lines are now cancelled.`
          : `Order ${result.orderNumber} completed, but some lines aren’t cancelled yet (a future effective date can delay this). Reload to see their current state.`,
      });
    } catch (e) {
      setTermMsg({ id, kind: 'error', text: `Couldn’t terminate ${contract.number}: ${String(e.message ?? e)}` });
    } finally {
      setTerminating(null);
    }
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
                    {form?.id === c.sys_id && (
                      <form
                        className="term-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          terminate(c);
                        }}
                      >
                        <p>
                          <strong>Terminate {c.number}?</strong> This cancels the whole contract and all of its
                          lines and can’t be undone.
                        </p>
                        <label>
                          Effective cancellation date
                          <input
                            type="date"
                            required
                            value={form.date}
                            min={form.min || undefined}
                            max={form.max || undefined}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                          />
                        </label>
                        <label>
                          Reason
                          <input
                            type="text"
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                          />
                        </label>
                        <button className="btn danger" type="submit">Confirm termination</button>
                        <button className="btn" type="button" onClick={() => setForm(null)}>Cancel</button>
                      </form>
                    )}
                    {terminating?.id === c.sys_id && <p className="muted">{terminating.step}</p>}
                    {termMsg?.id === c.sys_id && <p className={`term-msg ${termMsg.kind}`}>{termMsg.text}</p>}
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
                                  <button className="btn" disabled={!!terminating} onClick={() => amend(l, c)}>Amend</button>
                                )}
                                {l.isTopLine && c.state?.toLowerCase() === 'active' && (
                                  <button className="btn danger" disabled={!!terminating} onClick={() => startTerminate(l, c)}>
                                    {terminating?.id === c.sys_id ? 'Terminating…' : 'Terminate'}
                                  </button>
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
