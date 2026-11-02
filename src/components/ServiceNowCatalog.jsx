'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildEntityDetails,
  UX_THEME_ID,
  CATALOG_TEMPLATE_ID,
  CONFIGURATOR_TEMPLATE_ID,
} from '@/lib/catalogContext';

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
export default function ServiceNowCatalog({ onEvent }) {
  const hostRef = useRef(null);
  const onEventRef = useRef(onEvent);
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
    if (tenant) {
      // The Logik UI makes its API calls with axios, which uses XHR.
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        const u = String(url);
        return nativeXhrOpen.call(
          this,
          method,
          u.startsWith(tenant) ? `/logik${u.slice(tenant.length)}` : url,
          ...rest
        );
      };
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (!url.startsWith(tenant)) return nativeFetch(input, init);
        const proxied = `/logik${url.slice(tenant.length)}`;
        return nativeFetch(input instanceof Request ? new Request(proxied, input) : proxied, init);
      };
    }

    async function mount() {
      try {
        // Loaded via the same-origin proxy (src/middleware.js), not bundled.
        const mod = await import(
          /* webpackIgnore: true */ '/sn_b2b_portal.embedabbles.jsdbx'
        );
        await mod.loadTheme(UX_THEME_ID);
        await mod.getTemplates([CATALOG_TEMPLATE_ID, CONFIGURATOR_TEMPLATE_ID]);
        if (cancelled) return;

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
          configurator.style.display = 'none';
          catalog.style.display = 'block';
        };

        const emit = (name, payload) => {
          console.log('[catalog]', name, payload);
          onEventRef.current?.(name, payload);
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
                showCatalog();
              },
            ])
          )
        );

        hostRef.current.replaceChildren(catalog, configurator);
        setStatus('ready');
      } catch (e) {
        console.error('[catalog] failed to mount', e);
        setError(String(e));
        setStatus('error');
      }
    }

    mount();
    return () => {
      cancelled = true;
      window.fetch = nativeFetch;
      XMLHttpRequest.prototype.open = nativeXhrOpen;
    };
  }, []);

  return (
    <div>
      {status === 'loading' && <p>Loading catalog…</p>}
      {status === 'error' && <div className="embed-empty">Catalog failed to load: {error}</div>}
      <div ref={hostRef} />
    </div>
  );
}
