/* ════════════════════════════════════════════════════════════════════
   OVERWATCH // Cloudflare Worker · TRUE bypass proxy
   ════════════════════════════════════════════════════════════════════

   This is the actual "complete bypass" for sites that block iframe
   embedding (EarthCam, SkylineWebcams, most CCTV pages).

   The browser blocks iframes when the destination page sends
   X-Frame-Options: DENY / SAMEORIGIN or a frame-ancestors CSP.
   The browser CANNOT see headers the server doesn't send.
   So: route the request through THIS worker; the worker fetches the
   target page; strips the blocking headers; returns the page to the
   browser; the browser has no reason to block; iframe loads.

   ──────────────────────────────────────────────────────────────────
   DEPLOY (3 minutes, free, no credit card required):
   ──────────────────────────────────────────────────────────────────

   1.  Sign up at https://dash.cloudflare.com/sign-up (free tier).
   2.  Top-right: Workers & Pages → Create application → Create Worker.
   3.  Name it `overwatch-proxy` → Deploy.
   4.  After deploy, click "Edit code" on the worker page.
   5.  Delete the placeholder code in the editor.
   6.  Paste THIS ENTIRE FILE into the editor.
   7.  Click "Deploy".
   8.  Copy your worker URL — looks like
       https://overwatch-proxy.YOURNAME.workers.dev
   9.  Open the OVERWATCH dashboard.
       Bottom of the QUERY panel: paste the worker URL into "PROXY URL"
       input and press Enter. It's saved in localStorage.
   10. Click any cam node → page loads INLINE through the worker.

   Free tier gives you 100,000 requests/day. That's ~3000 watch
   sessions per day at zero cost.

   ──────────────────────────────────────────────────────────────────
   How it works (you can read this, it's ~80 lines of JS)
   ────────────────────────────────────────────────────────────────── */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight pass-through
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('OVERWATCH bypass · ready\n\nusage: /proxy?url=<encoded URL>', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders() }
      });
    }

    if (url.pathname !== '/proxy') {
      return new Response('not found', { status: 404, headers: corsHeaders() });
    }

    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('missing ?url= param', { status: 400, headers: corsHeaders() });
    }

    let targetUrl;
    try { targetUrl = new URL(target); }
    catch { return new Response('bad url', { status: 400, headers: corsHeaders() }); }

    // Fetch the target page
    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent': request.headers.get('User-Agent') ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': targetUrl.origin + '/'
        },
        redirect: 'follow'
      });
    } catch (e) {
      return new Response('upstream fetch failed: ' + e.message, {
        status: 502, headers: corsHeaders()
      });
    }

    // Build response headers — strip everything that blocks iframe
    const out = new Headers();
    upstream.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (
        lk === 'x-frame-options' ||
        lk === 'content-security-policy' ||
        lk === 'content-security-policy-report-only' ||
        lk === 'cross-origin-resource-policy' ||
        lk === 'cross-origin-opener-policy' ||
        lk === 'cross-origin-embedder-policy' ||
        lk === 'permissions-policy' ||
        lk === 'feature-policy' ||
        lk === 'set-cookie' ||
        lk === 'strict-transport-security'
      ) return;
      out.set(k, v);
    });
    Object.entries(corsHeaders()).forEach(([k, v]) => out.set(k, v));

    // If HTML, inject a <base> so relative URLs work AND rewrite some
    // links to keep navigation inside the proxy.
    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) {
      let body = await upstream.text();
      const proxyBase = url.origin + '/proxy?url=';

      // Inject <base> if missing
      if (!/<base\s/i.test(body)) {
        body = body.replace(
          /<head[^>]*>/i,
          (m) => m + `<base href="${targetUrl.origin}/">`
        );
      }

      // Rewrite same-origin <a href="..."> and form actions through the proxy
      // (so user-clicked links don't escape the bypass)
      body = body.replace(
        /(href|action|src)=(["'])([^"']+)\2/gi,
        (full, attr, q, val) => {
          // Skip data: / blob: / mailto: / javascript: / fragment-only
          if (/^(data:|blob:|mailto:|tel:|javascript:|#)/i.test(val)) return full;
          // hls.js streams + media should NOT go through worker
          if (/\.(m3u8|mpd|ts|jpg|jpeg|png|gif|webp|mp4|webm|css|js|woff2?|ico|svg)(\?|$)/i.test(val)) return full;
          // Resolve to absolute, then route through proxy
          try {
            const abs = new URL(val, targetUrl).toString();
            // only rewrite anchors / form actions (not media which we left alone)
            if (attr.toLowerCase() === 'href' || attr.toLowerCase() === 'action') {
              return `${attr}=${q}${proxyBase}${encodeURIComponent(abs)}${q}`;
            }
          } catch {}
          return full;
        }
      );

      out.set('content-type', 'text/html; charset=utf-8');
      return new Response(body, { status: upstream.status, headers: out });
    }

    // Non-HTML: stream-through as-is
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }
};

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': '*'
  };
}
