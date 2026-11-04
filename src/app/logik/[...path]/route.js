// Same-origin proxy to the Logik tenant. The CPQ configurator web component
// POSTs to <tenant>/auth/exchange with credentials, and the tenant only
// allows the ServiceNow instance's origin for that call. ServiceNowCatalog.jsx
// redirects tenant-bound fetches here so the browser never goes cross-origin.
const TENANT = process.env.NEXT_PUBLIC_LOGIK_TENANT_URL;

const HOP_BY_HOP = ['host', 'connection', 'content-length', 'accept-encoding'];

async function proxy(request, { params }) {
  if (!TENANT) {
    return new Response('NEXT_PUBLIC_LOGIK_TENANT_URL is not configured', { status: 500 });
  }

  const target = new URL(`${TENANT}/${params.path.join('/')}${request.nextUrl.search}`);
  const headers = new Headers(request.headers);
  HOP_BY_HOP.forEach((h) => headers.delete(h));

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  // TEMP debug: what Logik returns when a configuration is saved.
  if (request.nextUrl.searchParams.get('save') === 'true') {
    console.log('[logik-save]', upstream.status, (await upstream.clone().text()).slice(0, 3000));
  }

  const out = new Headers(upstream.headers);
  // fetch() already decoded the body, and CORS headers are irrelevant same-origin.
  ['content-encoding', 'content-length', 'transfer-encoding'].forEach((h) => out.delete(h));
  [...out.keys()].filter((h) => h.startsWith('access-control-')).forEach((h) => out.delete(h));

  // The tenant sets cookies for its own domain; re-scope them to this origin.
  out.delete('set-cookie');
  for (const cookie of upstream.headers.getSetCookie()) {
    out.append(
      'set-cookie',
      cookie.replace(/;\s*Domain=[^;]*/i, '').replace(/;\s*SameSite=[^;]*/i, '; SameSite=Lax')
    );
  }

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
