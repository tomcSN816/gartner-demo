// Fired when the catalog or configurator changes the cart, so the nav badge
// and Cart page can refetch.
export const CART_CHANGED = 'portal:cart-changed';

export const CART_EVENTS = new Set([
  'PRODUCT_CATALOG#ADD_TO_CART',
  'SN_PRODUCT_CATALOG#COMMIT_RESPONSE',
  'SN_PRODUCT_CONFIGURATION#COMMIT_REPONSE', // sic: spelled this way by ServiceNow
]);

export function notifyCartChanged() {
  window.dispatchEvent(new Event(CART_CHANGED));
}
