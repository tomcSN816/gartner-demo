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
];

// Lines of one contract. product_offering keeps its sys_id (needed to open the configurator).
export async function getContractLines(contractId) {
  const rows = await snQuery('sn_pss_core_service_contract_line', {
    query: `contract=${contractId}`,
    fields: CONTRACT_LINE_FIELDS,
    limit: 100,
    displayValue: 'all',
  });
  return rows.map((r) => {
    const o = {};
    for (const k of CONTRACT_LINE_FIELDS) o[k] = r[k]?.display_value ?? '';
    o.sys_id = r.sys_id?.value ?? r.sys_id;
    o.offeringId = r.product_offering?.value ?? '';
    o.isTopLine = !r.parent_contract_line?.value;
    return o;
  });
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
