// Public pilot universe. Expanding it requires a source and usage-rights review.
export const assets = [
  { id: 'ko', market: 'us', kind: 'equity', symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Staples', cik: '0000021344', sourceId: 'sec-ko' },
  { id: 'wmt', market: 'us', kind: 'equity', symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', cik: '0000104169', sourceId: 'sec-wmt' },
  { id: 'xom', market: 'us', kind: 'equity', symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', cik: '0000034088', sourceId: 'sec-xom' },
  { id: 'btc', market: 'crypto', kind: 'token', symbol: 'BTC/USDT', name: 'Bitcoin', sector: 'Digital Assets', pair: 'BTCUSDT', sourceId: 'binance-btc' },
  { id: 'eth', market: 'crypto', kind: 'token', symbol: 'ETH/USDT', name: 'Ethereum', sector: 'Layer 1', pair: 'ETHUSDT', sourceId: 'binance-eth' }
];

export const markets = [
  { id: 'a-share', name: 'A 股', status: 'unconnected', note: '披露可查；自动采集来源与使用权待验证' },
  { id: 'hong-kong', name: '港股', status: 'restricted', note: '港交所公开页面限制自动抓取与文本挖掘' },
  { id: 'us', name: '美股', status: 'pilot', note: 'SEC 披露试点；行情尚未接入' },
  { id: 'crypto', name: '加密资产', status: 'pilot', note: 'Binance 现货日线试点，仅代表该交易对' }
];

const metricTags = {
  revenue: 'Revenues',
  net_income: 'NetIncomeLoss',
  operating_cash_flow: 'NetCashProvidedByUsedInOperatingActivities'
};

async function getJson(url, headers = {}, fetcher = fetch) {
  const response = await fetcher(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  const size = Number(response.headers.get('content-length') || 0);
  if (size > 12_000_000) throw new Error('Upstream response too large');
  const body = await response.text();
  if (body.length > 12_000_000) throw new Error('Upstream response too large');
  return JSON.parse(body);
}

function daysBetween(start, end) {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
}

function factsForTag(asset, metric, fact, capturedAt) {
  const entries = fact?.units?.USD || [];
  const filtered = entries.filter(entry => {
    if (!Number.isFinite(entry.val) || !entry.start || !entry.end || !entry.accn || !entry.filed) return false;
    const duration = daysBetween(entry.start, entry.end);
    return (entry.form === '10-K' && entry.fp === 'FY' && duration >= 330 && duration <= 380) ||
      (entry.form === '10-Q' && duration >= 70 && duration <= 110);
  });
  const annualEnds = [...new Set(filtered.filter(entry => entry.form === '10-K').map(entry => entry.end))].sort().reverse();
  const quarterEnds = [...new Set(filtered.filter(entry => entry.form === '10-Q').map(entry => entry.end))].sort().reverse();
  const allowedAnnual = new Set(annualEnds.slice(0, 7));
  const allowedQuarter = new Set(quarterEnds.slice(0, 8));
  return filtered.filter(entry => entry.form === '10-K' ? allowedAnnual.has(entry.end) : allowedQuarter.has(entry.end)).map(entry => ({
    assetId: asset.id,
    metric,
    periodType: entry.form === '10-K' ? 'annual' : 'quarter',
    periodEnd: entry.end,
    fiscalYear: Number.isInteger(entry.fy) ? entry.fy : null,
    fiscalPeriod: entry.fp || null,
    filedAt: entry.filed,
    accession: entry.accn,
    value: entry.val,
    unit: 'USD',
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(asset.cik)}/${entry.accn.replaceAll('-', '')}/`,
    capturedAt
  }));
}

function filingsFromSubmissions(asset, submissions, capturedAt) {
  const recent = submissions?.filings?.recent || {};
  const rows = [];
  for (let i = 0; i < (recent.form || []).length && rows.length < 30; i++) {
    const form = recent.form[i];
    if (!['8-K', '10-Q', '10-K'].includes(form)) continue;
    const accession = recent.accessionNumber?.[i];
    const document = recent.primaryDocument?.[i];
    const filedAt = recent.filingDate?.[i];
    if (!accession || !document || !filedAt) continue;
    const description = String(recent.primaryDocDescription?.[i] || form).slice(0, 160);
    rows.push({
      id: `${asset.id}-${accession}`,
      assetId: asset.id,
      form,
      filedAt,
      title: description,
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(asset.cik)}/${accession.replaceAll('-', '')}/${encodeURIComponent(document)}`,
      capturedAt
    });
  }
  return rows;
}

export async function collectCompany(asset, userAgent, fetcher = fetch, capturedAt = new Date().toISOString()) {
  if (!userAgent || !userAgent.includes('@')) throw new Error('SEC User-Agent is not configured');
  const headers = { 'User-Agent': userAgent, Accept: 'application/json' };
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${asset.cik}.json`;
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${asset.cik}.json`;
  const factsBody = await getJson(factsUrl, headers, fetcher);
  const submissionsBody = await getJson(submissionsUrl, headers, fetcher);
  const tags = factsBody?.facts?.['us-gaap'] || {};
  const facts = Object.entries(metricTags).flatMap(([metric, tag]) => factsForTag(asset, metric, tags[tag], capturedAt));
  return { facts, filings: filingsFromSubmissions(asset, submissionsBody, capturedAt), bars: [] };
}

export async function collectCrypto(asset, fetcher = fetch, capturedAt = new Date().toISOString()) {
  const sourceUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${asset.pair}&interval=1d&limit=90`;
  const raw = await getJson(sourceUrl, { Accept: 'application/json' }, fetcher);
  if (!Array.isArray(raw)) throw new Error('Unexpected exchange response');
  const now = Date.now();
  const bars = raw.filter(row => Array.isArray(row) && Number(row[6]) < now).map(row => ({
    assetId: asset.id,
    day: new Date(Number(row[0])).toISOString().slice(0, 10),
    open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]),
    volume: Number(row[5]), quoteUnit: 'USDT', sourceUrl, capturedAt
  })).filter(row => [row.open, row.high, row.low, row.close, row.volume].every(Number.isFinite));
  return { facts: [], filings: [], bars };
}

export async function collectAsset(asset, userAgent, fetcher = fetch, capturedAt = new Date().toISOString()) {
  return asset.kind === 'equity'
    ? collectCompany(asset, userAgent, fetcher, capturedAt)
    : collectCrypto(asset, fetcher, capturedAt);
}
