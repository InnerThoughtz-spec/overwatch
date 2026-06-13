/* OVERWATCH // standalone CORS proxy + static server
   zero external deps.  run:   node proxy.js
   serves intel/ on http://localhost:8765
   proxies anything at  http://localhost:8765/proxy?url=<encoded>&auth=<header>  */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const ROOT = __dirname;
const PORT = 8765;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.webp':'image/webp',
  '.mp4':'video/mp4', '.webm':'video/webm',
  '.m3u8':'application/vnd.apple.mpegurl', '.ts':'video/mp2t'
};

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxy(req, res, parsed) {
  const target = parsed.query.url;
  const auth   = parsed.query.auth;
  if (!target) { res.writeHead(400); return res.end('missing url'); }
  let tgtUrl;
  try { tgtUrl = new URL(target); } catch { res.writeHead(400); return res.end('bad url'); }

  const lib = tgtUrl.protocol === 'https:' ? https : http;
  const opts = {
    method: req.method,
    hostname: tgtUrl.hostname,
    port: tgtUrl.port || (tgtUrl.protocol === 'https:' ? 443 : 80),
    path: tgtUrl.pathname + tgtUrl.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Overwatch-Intel/1.0)',
      'Accept': '*/*'
    }
  };
  if (auth) opts.headers['Authorization'] = auth;

  const upstream = lib.request(opts, up => {
    const h = { ...up.headers };
    h['access-control-allow-origin']  = '*';
    h['access-control-allow-headers'] = '*';
    h['access-control-allow-methods'] = 'GET,POST,OPTIONS';
    delete h['content-security-policy'];
    delete h['x-frame-options'];
    res.writeHead(up.statusCode || 502, h);
    up.pipe(res);
  });
  upstream.on('error', err => {
    res.writeHead(502, { 'Access-Control-Allow-Origin':'*', 'Content-Type':'text/plain' });
    res.end('proxy error: ' + err.message);
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
    });
    return res.end();
  }
  if (parsed.pathname === '/proxy') return proxy(req, res, parsed);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n╭───────────────────────────────────────────────╮`);
  console.log(`│  OVERWATCH // global intel grid              │`);
  console.log(`│  http://localhost:${PORT}                       │`);
  console.log(`│  proxy:  /proxy?url=<encoded>&auth=<header>  │`);
  console.log(`╰───────────────────────────────────────────────╯\n`);
});
