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
import { getSoldProductConfigInput } from '@/lib/servicenow';

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
export default function ServiceNowCatalog({ onEvent, amendLineId, amendLabel }) {
  const router = useRouter();
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

    // TEMP debug: see which cart/commit events the configurator fires.
    const nativeDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (event) {
      if (/COMMIT|SUBMIT|SAVE|CART|CONFIGURATION/i.test(event.type)) {
        console.log('[event]', event.type, event.detail?.payload ?? event.detail);
      }
      return nativeDispatch.call(this, event);
    };

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
          configurator.setAttribute('entity-details', JSON.stringify(details));
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
            openConfigurator(payload?.productData?.productId);
          },
        });

        mod.setEvents(
          configurator,
          Object.fromEntries(
            CONFIGURATOR_EVENTS.map((name) => [
              name,
              (e) => {
                emit(name, e.detail?.payload);
                if (amendLineId && name.endsWith('COMMIT_REPONSE')) {
                  router.push('/orders');
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
      EventTarget.prototype.dispatchEvent = nativeDispatch;
    };
  }, []);

  return (
    <div>
      {status === 'loading' && <p>Loading catalog…</p>}
      {amendLineId && (
        <div className="card amend-banner">
          <span className="pill">Amendment</span> {amendLabel || 'Modifying an existing contract line'}
        </div>
      )}
      {status === 'error' && <div className="embed-empty">Catalog failed to load: {error}</div>}
      <div ref={hostRef} />
    </div>
  );
}
