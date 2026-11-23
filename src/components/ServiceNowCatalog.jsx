'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildEntityDetails,
  UX_THEME_ID,
  CATALOG_TEMPLATE_ID,
  CONFIGURATOR_TEMPLATE_ID,
} from '@/lib/catalogContext';
import { CART_EVENTS, notifyCartChanged } from '@/lib/cartEvents';
import { getSoldProductConfigInput, ensurePortalQuote } from '@/lib/servicenow';

const CATALOG_EVENTS = [
  'PRODUCT_CATALOG#ADD_TO_CART',
  'SN_PRODUCT_CATALOG#CUSTOMIZE',
  'SN_PRODUCT_CATALOG#COMMIT_RESPONSE',
  'SN_PRODUCT_CATALOG_NEEDS#CAPTURE_NEEDS_BTN_CLICKED',
];

const CONFIGURATOR_EVENTS = [
  'SN_PRODUCT_CONFIGURATION#CANCEL',
  'SN_PRODUCT_CONFIGURATION#COMMIT_REPONSE', // sic: spelled this way by ServiceNow
];

// Mirrors the Product Catalog + Transaction configurator widgets on the
// instance's Business Portal: Customize swaps the catalog for the configurator.
export default function ServiceNowCatalog({ onEvent, logikLayout, logikTokens, urlParams, amendLineId, amendLabel, quoteLineId, guidedProductId }) {
  const router = useRouter();
  const urlParamsRef = useRef(urlParams);
  const hostRef = useRef(null);
  const onEventRef = useRef(onEvent);
  // Logik `layout` param: set to the reseller's layout while configuring.
  const logikLayoutRef = useRef(logikLayout);
  const layoutActiveRef = useRef(false);

  const logikTokensRef = useRef(logikTokens);

  useEffect(() => {
    logikLayoutRef.current = logikLayout;
    logikTokensRef.current = logikTokens;
    urlParamsRef.current = urlParams;
  }, [logikLayout, logikTokens, urlParams]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let cancelled = false;

    // The CPQ configurator calls the Logik tenant directly, which only allows
    // the ServiceNow origin. Send those calls through our /logik proxy instead.
    const tenant = process.env.NEXT_PUBLIC_LOGIK_TENANT_URL;
    const nativeFetch = window.fetch;
    const nativeXhrOpen = XMLHttpRequest.prototype.open;
    const proxyPath = (url) => `/logik${url.slice(tenant.length)}`;

    // Logik's own mechanism for choosing a layout: the `layout` attribute on
    // <logik-ui> (a layout variableName). Logik sends it to the server as
    // partnerData.layoutVarName and serves that layout. The ServiceNow wrapper
    // creates <logik-ui> itself and never sets the attribute, so set it at creation.
    const nativeCreateElement = document.createElement;
    document.createElement = function (tag, ...rest) {
      const el = nativeCreateElement.call(this, tag, ...rest);
      const layout = layoutActiveRef.current && logikLayoutRef.current;
      if (layout && String(tag).toLowerCase() === 'logik-ui') el.setAttribute('layout', layout);
      return el;
    };
    if (tenant) {
      // The Logik UI makes its API calls with axios, which uses XHR.
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        const u = String(url);
        return nativeXhrOpen.call(
          this,
          method,
          u.startsWith(tenant) ? proxyPath(u) : url,
          ...rest
        );
      };
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (!url.startsWith(tenant)) return nativeFetch(input, init);
        const proxied = proxyPath(url);
        return nativeFetch(input instanceof Request ? new Request(proxied, input) : proxied, init);
      };
    }

    // Re-colour the Logik UI by overriding its --lgk-* tokens in the document
    // and in every shadow root (the widgets render inside shadow DOM).
    const sheet = new CSSStyleSheet();
    const adopted = new WeakSet();
    const observers = [];
    // Reflect the active theme/layout in the address bar while configuring.
    const syncUrl = (on) => {
      const params = urlParamsRef.current;
      if (!params) return;
      const url = new URL(window.location.href);
      Object.entries(params).forEach(([k, v]) =>
        on ? url.searchParams.set(k, v) : url.searchParams.delete(k)
      );
      window.history.replaceState(window.history.state, '', url);
    };
    const setTheme = (on) => {
      syncUrl(on);
      const tokens = logikTokensRef.current;
      if (!on || !tokens) return sheet.replaceSync('');
      const decls = Object.entries(tokens)
        .map(([k, v]) => `--lgk-${k}: ${v} !important;`)
        .join(' ');
      sheet.replaceSync(`:host, :root, * { ${decls} }`);
    };
    const adopt = (root) => {
      if (adopted.has(root)) return;
      adopted.add(root);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      const mo = new MutationObserver(() => scan(root));
      mo.observe(root, { childList: true, subtree: true });
      observers.push(mo);
    };
    const scan = (root) => {
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) {
          adopt(el.shadowRoot);
          scan(el.shadowRoot);
        }
      });
    };
    adopt(document);
    scan(document);

    async function mount() {
      try {
        // Loaded via the same-origin proxy (src/middleware.js), not bundled.
        const mod = await import(
          /* webpackIgnore: true */ '/sn_b2b_portal.embedabbles.jsdbx'
        );
        await mod.loadTheme(UX_THEME_ID);
        await mod.getTemplates([CATALOG_TEMPLATE_ID, CONFIGURATOR_TEMPLATE_ID]);
        if (cancelled) return;

        // Everything configured here commits into the portal's draft quote, whose
        // lines keep their saved configuration so Reconfigure can reload it.
        const quoteId = guidedProductId ? '' : await ensurePortalQuote();
        if (cancelled) return;
        const toQuote = (details) => {
          details.headerId = quoteId;
          details.nonEntityBasedFlow = false;
          details.metadata.sourceEntityId = 'sn_l2c_quote';
          details.metadata.sourceToTargetEntityId = 'sn_l2c_quote_to_quote';
          return details;
        };

        const entityDetails = buildEntityDetails();

        const catalog = document.createElement(`macroponent-${CATALOG_TEMPLATE_ID}`);
        catalog.setAttribute('bare', '');
        catalog.setAttribute('entity-details', JSON.stringify(entityDetails));
        catalog.style.display = 'block';

        const configurator = document.createElement(
          `macroponent-${CONFIGURATOR_TEMPLATE_ID}`
        );
        configurator.setAttribute('bare', '');
        configurator.style.display = 'none';

        const showCatalog = () => {
          layoutActiveRef.current = false;
          setTheme(false);
          configurator.style.display = 'none';
          catalog.style.display = 'block';
        };

        const emit = (name, payload) => {
          console.log('[catalog]', name, payload);
          if (CART_EVENTS.has(name)) notifyCartChanged();
          onEventRef.current?.(name, payload);
        };

        const openConfigurator = (productId) => {
          const details = buildEntityDetails({ timestamp: Date.now(), productId });
          // Net effect of the widget's handler + server script when
          // advanced configuration is enabled: pricing is not skipped.
          details.metadata.contextParams.skip_pricing = false;

          configurator.setAttribute('entity-details', JSON.stringify(details));
          configurator.setAttribute('channel', details.metadata.sourceSystem);
          catalog.style.display = 'none';
          configurator.style.display = 'block';
        };

        const openAmendment = async (lineId) => {
          const details = await getSoldProductConfigInput(lineId);
          // Same as Customize: the instance script returns skip_pricing=true,
          // which leaves every amended line at $0.00.
          details.metadata.contextParams.skip_pricing = false;
          // The script returns no header context (account, price list, currency);
          // without a price list nothing can be priced. Reuse Customize's.
          const base = buildEntityDetails();
          details.headerContext = { ...base.headerContext, ...details.headerContext };
          details.settings = { ...base.settings, ...details.settings };
          configurator.setAttribute('channel', base.metadata.sourceSystem);
          layoutActiveRef.current = true;
          setTheme(true);
          scan(document);
          configurator.setAttribute('entity-details', JSON.stringify(details));
          catalog.style.display = 'none';
          configurator.style.display = 'block';
        };

        // Arrived from the cart's Reconfigure button: reopen that quote line's
        // saved configuration in place, as the instance's line Customize does.
        const openQuoteLine = (lineId) => {
          const details = toQuote(
            buildEntityDetails({
              timestamp: Date.now(),
              lineId,
              originTable: 'sn_quote_mgmt_core_quote_line_item',
            }),
          );
          details.metadata.contextParams.skip_pricing = false;
          configurator.setAttribute('channel', details.metadata.sourceSystem);
          layoutActiveRef.current = true;
          setTheme(true);
          scan(document);
          configurator.setAttribute('entity-details', JSON.stringify(details));
          catalog.style.display = 'none';
          configurator.style.display = 'block';
        };

        // Guided Selling: open one product's configurator straight away, with no
        // catalog in between and nothing added to the portal quote.
        const openGuided = () => {
          const details = buildEntityDetails({ timestamp: Date.now(), productId: guidedProductId });
          details.metadata.contextParams.skip_pricing = false;
          layoutActiveRef.current = true;
          setTheme(true);
          scan(document);
          configurator.setAttribute('entity-details', JSON.stringify(details));
          configurator.setAttribute('channel', details.metadata.sourceSystem);
          catalog.style.display = 'none';
          configurator.style.display = 'block';
        };

        mod.setEvents(catalog, {
          ...Object.fromEntries(
            CATALOG_EVENTS.map((name) => [name, (e) => emit(name, e.detail?.payload)])
          ),
          'SN_PRODUCT_CATALOG#CUSTOMIZE': (e) => {
            const payload = e.detail?.payload;
            emit('SN_PRODUCT_CATALOG#CUSTOMIZE', payload);

            const details = buildEntityDetails({
              timestamp: Date.now(),
              productId: payload?.productData?.productId,
            });
            // Net effect of the widget's handler + server script when
            // advanced configuration is enabled: pricing is not skipped.
            details.metadata.contextParams.skip_pricing = false;

            toQuote(details);

            // Logik calls from here on carry layout=<reseller layout>.
            layoutActiveRef.current = true;
            setTheme(true);
            scan(document);
            configurator.setAttribute('entity-details', JSON.stringify(details));
            configurator.setAttribute('channel', details.metadata.sourceSystem);
            catalog.style.display = 'none';
            configurator.style.display = 'block';
          },
        });

        mod.setEvents(
          configurator,
          Object.fromEntries(
            CONFIGURATOR_EVENTS.map((name) => [
              name,
              (e) => {
                emit(name, e.detail?.payload);
                if (guidedProductId) {
                  openGuided(); // start a fresh session instead of falling back to the catalog
                  return;
                }
                if (amendLineId && name.endsWith('COMMIT_REPONSE')) {
                  router.push('/orders');
                  return;
                }
                if (quoteLineId && name.endsWith('COMMIT_REPONSE')) {
                  router.push('/cart');
                  return;
                }
                showCatalog();
              },
            ])
          )
        );

        hostRef.current.replaceChildren(catalog, configurator);
        setStatus('ready');
        // Arrived from a contract line's Amend button: open that line's saved
        // configuration (as the instance's "Modify entire line" does).
        if (amendLineId) await openAmendment(amendLineId);
        else if (quoteLineId) openQuoteLine(quoteLineId);
        else if (guidedProductId) openGuided();
      } catch (e) {
        console.error('[catalog] failed to mount', e);
        setError(String(e));
        setStatus('error');
      }
    }

    mount();
    return () => {
      cancelled = true;
      observers.forEach((o) => o.disconnect());
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== sheet);
      window.fetch = nativeFetch;
      XMLHttpRequest.prototype.open = nativeXhrOpen;
      document.createElement = nativeCreateElement;
    };
  }, []);

  return (
    <div className="sn-embed">
      {status === 'loading' && <p>Loading catalog…</p>}
      {amendLineId && (
        <div className="card amend-banner">
          <span className="pill">Amendment</span> {amendLabel || 'Modifying an existing contract line'}
        </div>
      )}
      {quoteLineId && (
        <div className="card amend-banner">
          <span className="pill">Reconfigure</span> {amendLabel || 'Editing a cart line'}
        </div>
      )}
      {status === 'error' && <div className="embed-empty">Catalog failed to load: {error}</div>}
      <div ref={hostRef} />
    </div>
  );
}
