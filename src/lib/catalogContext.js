// Mirrors what the instance's Product Catalog widget builds server-side via
// sn_prd_pm.ProductCatalogContextAPI().executeProductCatalogContextExtension(
//   {}, { entity: 'sn_l2c_cart' }).
// Instance-specific ids: the real extension uses the signed-in user for
// contact/opened_by and the default cart price list for pricelist. We proxy
// as the SN_USERNAME user ("admin"), so these are that user's sys_id and the
// "Standard Price List" (USD) on the configured instance.
export const PRICELIST_ID = '94ed8a972bb243104deaf02ac891bf4f';
const USER_ID = '4bf687c02bd38f104deaf02ac891bfe3';
export const CONTACT_ID = USER_ID; // Jack Thompson (Southern Cross Analytics contact)
export const ACCOUNT_ID = 'b6d547003b5bcb10d5260fa693e45a4e'; // Southern Cross Analytics (ACCT0010047)

export function buildEntityDetails(overrides = {}) {
  return {
    headerId: '',
    nonEntityBasedFlow: true,
    metadata: {
      sourceSystem: 'self_service_portal',
      sourceEntityId: 'sn_l2c_cart',
      sourceToTargetEntityId: 'sn_l2c_cart_to_cart',
      contextParams: { flag_last_item: true, skip_pricing: false },
    },
    readonly: false,
    headerContext: {
      account: ACCOUNT_ID,
      consumer: '',
      pricelist: PRICELIST_ID,
      currency: 'USD',
      suppressPricing: false,
      channel: 'self_service_portal',
      contact: USER_ID,
      opened_by: USER_ID,
      transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      sales_agreement: '',
    },
    settings: { isAdvancedConfigurationEnabled: 'true' },
    ...overrides,
  };
}

// UX theme mapped to the Business Portal's Coral theme
// (sys_properties: ux_portal_theme_to_uib_theme_mapping.60bed96c93131210aa38860754891827)
export const UX_THEME_ID = 'fad87d2ca304121029a4d1aed31e610f';
export const CATALOG_TEMPLATE_ID = '089a21e6531021102a36ddeeff7b1277';

// "Transaction configurator" web component (CPQ / Logik configuration UI)
export const CONFIGURATOR_TEMPLATE_ID = '889db06643c231100325912a1bb8f241';
