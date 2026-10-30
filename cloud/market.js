// Binance Spot public market data. Only USDT spot pairs are exposed to this private desk.
const base = 'https://data-api.binance.vision/api/v3';
export const views = Object.freeze({
  second: { interval: '1s', limit: 300, label: '秒线 · 近 5 分钟' },
  intraday: { interval: '1m', limit: 480, label: '分时 · 近 8 小时' },
  fiveDay: { interval: '1h', limit: 120, label: '5 日 · 小时线' },
  daily: { interval: '1d', limit: 90, label: '日 K · 近 90 日' },
  weekly: { interval: '1w', limit: 52, label: '周 K · 近 1 年' },
  monthly: { interval: '1M', limit: 36, label: '月 K · 近 3 年' },
  year: { interval: '1d', limit: 365, label: '近 1 年 · 日 K' }
});

let symbolsCache = null;
let symbolsAt = 0;
async function request(path, fetcher = fetch) {
  const response = await fetcher(`${base}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  return response.json();
}

export async function spotSymbols(fetcher = fetch) {
  if (symbolsCache && Date.now() - symbolsAt < 15 * 60_000) return symbolsCache;
  const info = await request('/exchangeInfo', fetcher);
  if (!Array.isArray(info.symbols)) throw new Error('Invalid exchangeInfo');
  symbolsCache = info.symbols.filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
    .map(s => ({ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: s.quoteAsset }));
  symbolsAt = Date.now();
  return symbolsCache;
}

export async function searchSpot(query, fetcher = fetch) {
  const q = String(query || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(q)) return [];
  const symbols = await spotSymbols(fetcher);
  return symbols.filter(s => s.symbol.startsWith(q) || s.baseAsset.startsWith(q))
    .sort((a, b) => Number(b.symbol.startsWith(q)) - Number(a.symbol.startsWith(q)) || a.symbol.length - b.symbol.length || a.symbol.localeCompare(b.symbol))
    .slice(0, 20);
}

export async function spotDetail(symbol, view = 'daily', fetcher = fetch) {
  const pair = String(symbol || '').toUpperCase();
  const selected = views[view];
  if (!selected || !/^[A-Z0-9]{3,20}$/.test(pair)) return null;
  const universe = await spotSymbols(fetcher);
  const instrument = universe.find(s => s.symbol === pair);
  if (!instrument) return null;
  const [raw, ticker, rawDay] = await Promise.all([
    request(`/klines?symbol=${pair}&interval=${selected.interval}&limit=${selected.limit}`, fetcher),
    request(`/ticker/24hr?symbol=${pair}`, fetcher),
    selected.interval === '1d' ? Promise.resolve(null) : request(`/klines?symbol=${pair}&interval=1d&limit=3`, fetcher)
  ]);
  if (!Array.isArray(raw)) throw new Error('Invalid klines');
  const now = Date.now();
  const rows = raw.map(row => ({
    at: new Date(Number(row[0])).toISOString(),
    closeAt: new Date(Number(row[6])).toISOString(),
    open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]),
    volume: Number(row[5]), quoteVolume: Number(row[7]), trades: Number(row[8]),
    takerBuyQuote: Number(row[10]), closed: Number(row[6]) < now
  })).filter(row => [row.open,row.high,row.low,row.close,row.volume,row.quoteVolume,row.takerBuyQuote].every(Number.isFinite));
  const daily = (rawDay || raw).filter(row => Number(row[6]) < now);
  const currentDay = (rawDay || raw).find(row => Number(row[0]) <= now && Number(row[6]) >= now);
  return {
    source: 'Binance Spot', sourceUrl: `${base}/klines?symbol=${pair}&interval=${selected.interval}&limit=${selected.limit}`,
    fetchedAt: new Date().toISOString(), symbol: pair, baseAsset: instrument.baseAsset, quoteAsset: 'USDT',
    view, viewLabel: selected.label, interval: selected.interval, rows,
    dayOpen: currentDay ? Number(currentDay[1]) : null,
    previousClose: daily.length ? Number(daily.at(-1)[4]) : null,
    rolling24h: {
      last: Number(ticker.lastPrice), open: Number(ticker.openPrice), high: Number(ticker.highPrice),
      low: Number(ticker.lowPrice), volume: Number(ticker.volume), quoteVolume: Number(ticker.quoteVolume),
      changePercent: Number(ticker.priceChangePercent), trades: Number(ticker.count)
    }
  };
}
