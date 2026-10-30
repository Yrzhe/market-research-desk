import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { searchSpot, spotDetail } from '../cloud/market.js';

const port = Number(process.env.MARKET_DATA_PORT || 8971);
const secret = process.env.MARKET_DATA_ORIGIN_TOKEN;
if (!secret || secret.length < 32) throw new Error('MARKET_DATA_ORIGIN_TOKEN is required');
function authorized(request) {
  const value = request.headers['x-market-origin-token'];
  if (typeof value !== 'string') return false;
  const received = Buffer.from(value), expected = Buffer.from(secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
function send(response, status, body) {
  response.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' });
  response.end(JSON.stringify(body));
}
http.createServer(async (request, response) => {
  if (!authorized(request)) return send(response, 403, { error:'Forbidden' });
  if (request.method !== 'GET') return send(response, 405, { error:'Method not allowed' });
  const url = new URL(request.url, 'http://localhost');
  try {
    if (url.pathname === '/health') return send(response, 200, { status:'ok' });
    if (url.pathname === '/search') {
      const q=url.searchParams.get('q') || '';
      if(q.length>20) return send(response,400,{error:'Query too long'});
      return send(response,200,{results:await searchSpot(q)});
    }
    if (url.pathname === '/detail') {
      const detail=await spotDetail(url.searchParams.get('symbol'),url.searchParams.get('view')||'daily');
      return detail ? send(response,200,detail) : send(response,404,{error:'Unsupported symbol or view'});
    }
    return send(response,404,{error:'Not found'});
  } catch (error) {
    console.error('market source failed', String(error?.message || error));
    return send(response,503,{error:'Market source unavailable'});
  }
}).listen(port, '127.0.0.1', () => console.log(`market-data listening on 127.0.0.1:${port}`));
