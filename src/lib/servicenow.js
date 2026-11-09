import { ACCOUNT_ID } from '@/lib/catalogContext';

// Read-only Table API access through the same-origin proxy (src/middleware.js).
export async function snQuery(table, { query, fields, limit = 25, orderByDesc, displayValue = 'true' } = {}) {
  const params = new URLSearchParams({
    sysparm_display_value: displayValue,
    sysparm_exclude_reference_link: 'true',
    sysparm_limit: String(limit),
  });
  const q = [query, orderByDesc && `ORDERBYDESC${orderByDesc}`].filter(Boolean).join('^');
  if (q) params.set('sysparm_query', q);
  if (fields) params.set('sysparm_fields', fields.join(','));

  // Retry: the proxy occasionally drops its upstream connection (ECONNRESET -> 500).
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`/api/now/table/${table}?${params}`);
    if (res.ok || res.status < 500) break;
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  if (!res.ok) throw new Error(`ServiceNow ${table} query failed (${res.status})`);
  return (await res.json()).result;
}

export const CART_FIELDS = [
  'sys_id', 'number', 'state', 'contact', 'price_list', 'currency',
  'total_one_time_price', 'total_monthly_recurring_price',
  'total_annual_recurring_price', 'total_amount', 'sys_created_on',
];

export const CART_LINE_FIELDS = [
  'sys_id', 'number', 'product_offering', 'quantity', 'unit_base_price',
  'monthly_recurring_price', 'annual_recurring_price',
  'cumulative_one_time_price', 'cumulative_net_price',
];

export const ORDER_FIELDS = [
  'sys_id', 'number', 'state', 'contact', 'order_type', 'channel',
  'total_one_time_price', 'total_monthly_recurring_price', 'sys_created_on',
];

export const ORDER_LINE_FIELDS = [
  'sys_id', 'number', 'product_offering', 'quantity', 'action', 'state',
  'cumulative_net_price',
];

// The cart the portal shows: the most recent one.
export async function getCurrentCart() {
  const [cart] = await snQuery('sn_sales_cart', {
    fields: CART_FIELDS,
    limit: 1,
    orderByDesc: 'sys_created_on',
  });
  return cart ?? null;
}

export function getCartLines(cartId) {
  return snQuery('sn_sales_cart_line_item', {
    query: `cart=${cartId}`,
    fields: CART_LINE_FIELDS,
    limit: 100,
  });
}

export function getOrders() {
  return snQuery('sn_ind_tmt_orm_order', {
    fields: ORDER_FIELDS,
    limit: 25,
    orderByDesc: 'sys_created_on',
  });
}

export function getOrderLines(orderId) {
  return snQuery('sn_ind_tmt_orm_order_line_item', {
    query: `order=${orderId}`,
    fields: ORDER_LINE_FIELDS,
    limit: 100,
  });
}

export const CONTRACT_FIELDS = [
  'sys_id', 'number', 'short_description', 'state', 'starts', 'ends',
  'total_contract_value', 'yearly_cost', 'po_number', 'renewable', 'payment_schedule',
];

// Customer contracts for the portal's account.
export function getContracts() {
  return snQuery('sn_pss_core_service_contract', {
    query: `account=${ACCOUNT_ID}`,
    fields: CONTRACT_FIELDS,
    limit: 50,
    orderByDesc: 'starts',
  });
}

export const CONTRACT_LINE_FIELDS = [
  'sys_id', 'number', 'name', 'product_offering', 'quantity', 'state',
  'starts', 'ends', 'unit_price', 'annual_recurring_price', 'parent_contract_line',
  'sold_product',
];

// Lines of one contract. product_offering keeps its sys_id (needed to open the configurator).
export async function getContractLines(contractId) {
  const rows = await snQuery('sn_pss_core_service_contract_line', {
    query: `contract=${contractId}`,
    fields: CONTRACT_LINE_FIELDS,
    limit: 100,
    displayValue: 'all',
  });
  const lines = rows.map((r) => {
    const o = {};
    for (const k of CONTRACT_LINE_FIELDS) o[k] = r[k]?.display_value ?? '';
    o.sys_id = r.sys_id?.value ?? r.sys_id;
    o.offeringId = r.product_offering?.value ?? '';
    o.soldProductId = r.sold_product?.value ?? '';
    o.isTopLine = !r.parent_contract_line?.value;
    return o;
  });
  // The query has no ordering, so the root can land anywhere. Put it first; sort is stable,
  // so every other line keeps the order the instance returned.
  return lines.sort((a, b) => b.isTopLine - a.isTopLine);
}

// Same server script the instance's "Modify entire line" action runs. Returns the
// configurator's entityDetails for the line's sold product, pointing at its saved
// configuration and flagged as a change (amendment).
const SP_CONFIG_INPUT_BROKER = '218fe323435e7510b31b700999b8f2df';

export async function getSoldProductConfigInput(contractLineId) {
  const res = await fetch('/api/now/uxf/databroker/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([
      {
        type: 'TRANSFORM',
        definitionSysId: SP_CONFIG_INPUT_BROKER,
        inputValues: {
          soldProductSysId: { type: 'JSON_LITERAL', value: contractLineId },
          table: { type: 'JSON_LITERAL', value: 'sn_pss_core_service_contract_line' },
        },
      },
    ]),
  });
  if (!res.ok) throw new Error(`Amend input request failed (${res.status})`);
  const [r] = (await res.json()).result;
  const out = r?.executionResult?.output;
  if (r?.errors?.length || !out) throw new Error(r?.errors?.[0] || 'No configuration input returned');
  if (out.showError) throw new Error(out.message || 'This line can’t be modified');
  return out;
}

// ---------------------------------------------------------------------------
// Terminate (disconnect) a whole contract.
//
// Sequence from contract-disconnect-sequence.md: the Data Broker creates a draft
// disconnect order, then the portal walks it through submit -> acknowledge ->
// complete lines over the Table API. Once the order is completed the platform
// itself cancels the contract and its lines, so nothing here calls the contract
// subflow directly.
// ---------------------------------------------------------------------------
const ORDER_TABLE = 'sn_ind_tmt_orm_order';
const ORDER_LINE_TABLE = 'sn_ind_tmt_orm_order_line_item';
const CONTRACT_TABLE = 'sn_pss_core_service_contract';

// "Run sold product to order subflows" (scope Customer Life Cycle Management Workflows).
// Verified present on krupacrm; the same-named copy in Contracts and Entitlement Workflows
// (2db0d59743554210d089d83cdfb8f2b4) behaves the same.
const DISCONNECT_BROKER = 'acc2dc57432e31105050ad6816b8f2c0';
// The platform cuts the flow off at ~30 s, so give up on the HTTP call a little after that.
const BROKER_TIMEOUT_MS = 50_000;

const CANCELLED = /^cancel+ed$/i;
export const todayIso = () => new Date().toLocaleDateString('en-CA'); // local date, YYYY-MM-DD
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, { what, timeoutMs, intervalMs = 1500 }) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() >= end) throw new Error(`Timed out waiting for ${what}`);
    await sleep(intervalMs);
  }
}

// PATCH one record. Retries only 5xx (the proxy occasionally drops its upstream
// connection); every write here sets a field to a fixed value, so a retry is safe.
async function snPatch(table, sysId, body) {
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(
      `/api/now/table/${table}/${sysId}?sysparm_fields=sys_id,state&sysparm_exclude_reference_link=true`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (res.status < 500) break;
    await sleep(300 * (attempt + 1));
  }
  if (!res.ok) {
    const detail = await res.json().then((j) => j?.error?.message).catch(() => '');
    throw new Error(`ServiceNow ${table} update failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return (await res.json()).result;
}

const snRaw = (table, opts) => snQuery(table, { ...opts, displayValue: 'false' });

async function orderState(orderId) {
  const [o] = await snRaw(ORDER_TABLE, { query: `sys_id=${orderId}`, fields: ['state'], limit: 1 });
  const state = o?.state ?? '';
  if (state === 'canceled' || state === 'rejected') throw new Error(`The disconnect order ended up ${state}`);
  return state;
}

const fetchOrderLines = (orderId) =>
  snRaw(ORDER_LINE_TABLE, {
    query: `order=${orderId}`,
    fields: ['sys_id', 'number', 'action', 'state', 'parent_line_item'],
    limit: 200,
  });

function findOrderId(out, depth = 0) {
  if (!out || typeof out !== 'object' || depth > 3) return '';
  if (typeof out.orderSysId === 'string' && out.orderSysId) return out.orderSysId;
  for (const v of Object.values(out)) {
    const id = findOrderId(v, depth + 1);
    if (id) return id;
  }
  return '';
}

const listDraftOrders = () =>
  snRaw(ORDER_TABLE, {
    query: `account=${ACCOUNT_ID}^state=draft`,
    fields: ['sys_id', 'number'],
    limit: 50,
    orderByDesc: 'sys_created_on',
  });

// Step 1. Returns { sys_id, number } of the draft disconnect order.
async function createDisconnectOrder({ contractId, rootSoldProductId, reason, effectiveDate }) {
  // For a disconnect, prepareDataAndExecuteSPtoOrderFlow ignores endDate (only suspend reads
  // it, as the resumption date). startDate is what carries through: it becomes
  // committed_due_date on the order lines. Today (or earlier) is sent as '' so it takes the
  // path the doc tested; only a later date is sent as startDate.
  const startDate = effectiveDate > todayIso() ? effectiveDate : '';

  // Snapshot existing drafts so the new order can be told apart without trusting clocks.
  const known = new Set((await listDraftOrders()).map((o) => o.sys_id));

  // The broker runs the flow inside this request. The 30 s cap ends the flow CANCELLED,
  // but the order and its lines already exist, so a timeout or a missing orderSysId is
  // not a failure: look the order up afterwards.
  let orderId = '';
  let brokerError = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BROKER_TIMEOUT_MS);
  try {
    const res = await fetch('/api/now/uxf/databroker/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      body: JSON.stringify([
        {
          type: 'TRANSFORM',
          definitionSysId: DISCONNECT_BROKER,
          inputValues: {
            spSysId: { type: 'JSON_LITERAL', value: contractId },
            action: { type: 'JSON_LITERAL', value: 'disconnect' },
            reason: { type: 'JSON_LITERAL', value: reason },
            startDate: { type: 'JSON_LITERAL', value: startDate },
            endDate: { type: 'JSON_LITERAL', value: effectiveDate },
            tableName: { type: 'JSON_LITERAL', value: CONTRACT_TABLE },
          },
        },
      ]),
    });
    const r = (await res.json().catch(() => null))?.result?.[0];
    orderId = findOrderId(r?.executionResult?.output);
    brokerError = r?.errors?.[0] || '';
  } catch {
    // Aborted or connection dropped: fall through to the lookup.
  } finally {
    clearTimeout(timer);
  }

  if (orderId) {
    const [o] = await snRaw(ORDER_TABLE, { query: `sys_id=${orderId}`, fields: ['sys_id', 'number'], limit: 1 });
    if (o) return o;
  }

  // Newest new draft whose root line is a disconnect of this contract's root sold product.
  try {
    return await waitFor(
      async () => {
        for (const o of (await listDraftOrders()).filter((d) => !known.has(d.sys_id))) {
          const root = await snRaw(ORDER_LINE_TABLE, {
            query: `order=${o.sys_id}^parent_line_itemISEMPTY^action=disconnect^sold_product=${rootSoldProductId}`,
            fields: ['sys_id'],
            limit: 1,
          });
          if (root.length) return o;
        }
        return null;
      },
      { what: 'the disconnect order to appear', timeoutMs: 20_000, intervalMs: 3000 },
    );
  } catch {
    throw new Error(
      `No disconnect order was created for this contract${brokerError ? ` (${brokerError})` : ''}. Check Orders for a draft order.`,
    );
  }
}

// Steps 2-4 on an existing draft disconnect order.
async function driveOrderToCompleted(orderId, note) {
  // Step 2. A non-disconnect child (e.g. nochange under a disconnect parent) blocks completion.
  note('Preparing order lines…');
  const initial = await fetchOrderLines(orderId);
  if (!initial.length) throw new Error('The disconnect order has no lines');
  for (const l of initial) {
    if (l.action !== 'disconnect') await snPatch(ORDER_LINE_TABLE, l.sys_id, { action: 'disconnect' });
  }

  // Step 3. Submit, wait for the platform to move it to `new`, then acknowledge.
  // Never acknowledge a `submitted` order.
  note('Submitting order…');
  await snPatch(ORDER_TABLE, orderId, { state: 'submitted' });
  await waitFor(async () => (await orderState(orderId)) === 'new', {
    what: 'the order to reach New',
    timeoutMs: 60_000,
  });
  note('Acknowledging order…');
  await snPatch(ORDER_TABLE, orderId, { state: 'acknowledged' });

  // Decompose settles with the root `acknowledged` and the children `new`. Proceed with
  // whatever is there if it doesn't settle; the platform will reject anything invalid.
  note('Waiting for the order to decompose…');
  const lines = await waitFor(
    async () => {
      const ls = await fetchOrderLines(orderId);
      return ls.every((l) => l.state === 'new' || l.state === 'acknowledged') ? ls : null;
    },
    { what: 'the order to decompose', timeoutMs: 30_000 },
  ).catch(() => fetchOrderLines(orderId));

  // Step 4. Children before parents, ending with the root (the line with no
  // parent_line_item). The doc describes a flat order, but krupacrm contracts nest
  // up to three levels, so go deepest first rather than just "children, then root".
  const byId = new Map(lines.map((l) => [l.sys_id, l]));
  const depth = (l) => {
    let d = 0;
    for (let p = byId.get(l.parent_line_item); p && d < 20; p = byId.get(p.parent_line_item)) d++;
    return d;
  };
  const ordered = lines.filter((l) => l.state !== 'completed').sort((a, b) => depth(b) - depth(a));
  for (const [i, l] of ordered.entries()) {
    note(`Completing order lines (${i + 1}/${ordered.length})…`);
    await snPatch(ORDER_LINE_TABLE, l.sys_id, { state: 'completed' });
  }

  note('Waiting for the order to complete…');
  await waitFor(async () => (await orderState(orderId)) === 'completed', {
    what: 'the order to complete',
    timeoutMs: 60_000,
  });
}

// Terminates the contract whose top line has sold product `rootSoldProductId`.
// Resolves with { orderNumber, lines, settled }: `lines` are the contract's lines
// re-read after the platform's cascade; `settled` is false if they weren't all
// Cancelled yet when we stopped waiting.
// `effectiveDate` is the effective cancellation date, YYYY-MM-DD.
export async function terminateContract({ contractId, rootSoldProductId, reason, effectiveDate, onProgress = () => {} }) {
  if (!rootSoldProductId) throw new Error('This contract’s top line has no sold product, so it can’t be disconnected');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '')) throw new Error('Choose an effective cancellation date');

  onProgress('Creating disconnect order…');
  const order = await createDisconnectOrder({
    contractId,
    rootSoldProductId,
    reason: reason || 'Terminated from the portal',
    effectiveDate,
  });

  try {
    await driveOrderToCompleted(order.sys_id, onProgress);
  } catch (e) {
    throw new Error(`${e.message}. Disconnect order ${order.number} was left part-way through.`);
  }

  // Step 5. The platform now cancels the contract, then its lines.
  onProgress('Cancelling contract lines…');
  await waitFor(
    async () => {
      const [c] = await snQuery(CONTRACT_TABLE, { query: `sys_id=${contractId}`, fields: ['state'], limit: 1 });
      return CANCELLED.test(c?.state ?? '');
    },
    { what: 'the contract to cancel', timeoutMs: 30_000, intervalMs: 2000 },
  ).catch(() => {});

  let lines = await getContractLines(contractId);
  const allCancelled = (ls) => ls.length > 0 && ls.every((l) => CANCELLED.test(l.state));
  if (!allCancelled(lines)) {
    await waitFor(
      async () => allCancelled((lines = await getContractLines(contractId))),
      { what: 'the contract lines to cancel', timeoutMs: 10_000, intervalMs: 2000 },
    ).catch(() => {});
  }
  return { orderNumber: order.number, lines, settled: allCancelled(lines) };
}
