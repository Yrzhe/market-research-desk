import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dashboardState, dataDir } from './core.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
if (!['127.0.0.1', '::1', 'localhost'].includes(host) && process.env.ALLOW_REMOTE !== '1') {
  throw new Error('Remote binding requires ALLOW_REMOTE=1 and an authenticated reverse proxy');
}
const publicDir = path.resolve('public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };
const publicFiles = new Set(['index.html', 'app.css', 'app.js', 'sample.json', 'favicon.svg',
  'fonts/IBMPlexSans-Regular.woff2', 'fonts/IBMPlexSans-Medium.woff2', 'fonts/IBMPlexSans-SemiBold.woff2',
  'fonts/IBMPlexSans-Bold.woff2', 'fonts/IBMPlexMono-Regular.woff2']);

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
  try {
    if (request.method !== 'GET') { response.writeHead(405, headers).end(); return; }
    if (pathname === '/api/state') {
      const state = await dashboardState(dataDir());
      response.writeHead(200, { ...headers, 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(state));
      return;
    }
    const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!publicFiles.has(filename)) { response.writeHead(404, headers).end(); return; }
    const bytes = await fs.readFile(path.join(publicDir, filename));
    response.writeHead(200, { ...headers, 'content-type': mime[path.extname(filename)] }).end(bytes);
  } catch {
    response.writeHead(500, headers).end('Unable to load dashboard');
  }
});
server.listen(port, host, () => process.stdout.write(`Market Research Desk listening on http://${host}:${port}\n`));
