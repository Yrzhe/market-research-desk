import fs from 'node:fs/promises';

// Fictional numbers exist only for the explicitly labelled visual preview.
const markets = [
  ['a-share', 'A 股市场广度', '上涨占比', '%', [47.2, 42.8, 39.4]],
  ['hong-kong', '港股市场成交', '主板成交额', 'HKD bn', [182.1, 176.4, 190.3]],
  ['us', '美股波动率', '波动率指数', 'pts', [17.8, 18.2, 21.1]],
  ['crypto', '加密市场市值', '总市值', 'USD bn', [2820, 2785, 2650]]
];
const assets = [
  { id: 'sample-a-x', market: 'a-share', symbol: 'AX-1', name: '示例公司 A', exchange: '示例市场', unit: 'CNY', values: [24.8, 25.2, 24.9] },
  { id: 'sample-h-x', market: 'hong-kong', symbol: 'HX-1', name: '示例公司 H', exchange: '示例市场', unit: 'HKD', values: [76.4, 75.8, 77.1] },
  { id: 'sample-u-x', market: 'us', symbol: 'UX-1', name: '示例公司 U', exchange: '示例市场', unit: 'USD', values: [128.4, 130.2, 127.6] },
  { id: 'sample-crypto-x', market: 'crypto', symbol: 'CX-1', name: '示例资产 X', exchange: '示例市场', unit: 'USD', values: [102, 100, 91.6] }
];
const days = ['2026-01-05', '2026-01-06', '2026-01-07'];
const marketClock = { 'a-share': '07:00:00', 'hong-kong': '08:00:00', us: '21:00:00', crypto: '00:00:00' };
const runs = days.map((day, i) => {
  const startedAt = `${day}T23:10:00.000Z`;
  const runId = `${day}T23-10-00-000Z-${String(i+1).padStart(6,'0')}`;
  const observations = markets.map(([market, sourceId, label, unit, values]) => ({
    market, sourceId, metricId: 'headline', label, value: values[i], unit,
    assetId: null, role: null, quality: 'valid', asOf: `${day}T${marketClock[market]}.000Z`, fetchedAt: startedAt
  })).concat(assets.map(asset => ({
    market: asset.market, sourceId: `${asset.id}-price`, metricId: 'price', assetId: asset.id, role: 'price',
    label: '参考报价', value: asset.values[i], unit: asset.unit, quality: 'valid',
    asOf: `${day}T${marketClock[asset.market]}.000Z`, fetchedAt: startedAt
  })));
  const sources = markets.map(([market, id]) => ({ id, market, status: 'ok', fetchedAt: startedAt, count: 1, sourceUrl: null, definition: { metrics: [{ id: 'headline', assetId: null }] } }))
    .concat(assets.map(asset => ({ id: `${asset.id}-price`, market: asset.market, status: 'ok', fetchedAt: startedAt, count: 1, sourceUrl: null,
      definition: { metrics: [{ id: 'price', assetId: asset.id, role: 'price', unit: asset.unit }] } })));
  const alerts = i === 2 ? [{ id: 'sample-alert-01', market: 'crypto', assetId: null, sourceId: '加密市场市值', metricId: 'headline',
    label: '总市值', before: 2785, after: 2650, unit: 'USD bn', difference: -135,
    percent: (2650 - 2785) / 2785 * 100, beforeAsOf: `${days[1]}T00:00:00.000Z`, asOf: `${day}T00:00:00.000Z`,
    severity: 'review', status: 'unverified', thresholds: { absolute: null, percent: 4 }, formula: '(current - previous) / abs(previous) × 100' },
  { id: 'sample-alert-02', market: 'crypto', assetId: 'sample-crypto-x', sourceId: 'sample-crypto-x-price', metricId: 'price',
    label: '参考报价', before: 100, after: 91.6, unit: 'USD', difference: -8.4, percent: -8.4,
    beforeAsOf: `${days[1]}T00:00:00.000Z`, asOf: `${day}T00:00:00.000Z`, severity: 'review', status: 'unverified',
    thresholds: { absolute: null, percent: 8 }, formula: '(current - previous) / abs(previous) × 100' }] : [];
  return { schemaVersion: 1, runId, startedAt, finishedAt: startedAt,
    assets: assets.map(({ id, market, symbol, name, exchange }) => ({ id, market, symbol, name, exchange })),
    observations, alerts, sources, notifications: [] };
});
const newest = runs[2];
const decisions = [{ id: 'sample-decision-01', market: 'crypto', assetId: 'sample-crypto-x', asset: '示例资产 X', verdict: '证据不足',
  asOf: '2026-01-06T12:00:00.000Z', price: null, currency: 'USD', horizon: '30 天',
  thesis: '需要进一步核对公开披露、使用量与供给变化。',
  counterEvidence: '当前合成样本无法支持明确的价值判断。',
  invalidatedBy: '若可核对的数据仍不足，维持未裁决并复核。',
  reviewAt: '2026-01-07T12:00:00.000Z', evidenceRunIds: [newest.runId] }];
const state = { sample: true, generatedAt: '2026-01-07T23:12:00.000Z', latest: newest,
  markets: Object.fromEntries(markets.map(([market]) => [market, { status: 'ok', observation: newest.observations.find(o => o.market === market && !o.assetId), observations: newest.observations.filter(o => o.market === market && !o.assetId) }])),
  assets: assets.map(({ values, unit, ...asset }) => ({ ...asset, status: 'ok', observations: newest.observations.filter(o => o.assetId === asset.id) })),
  alerts: newest.alerts.map(a => ({ ...a, runId: newest.runId })),
  decisions, decisionError: false,
  documents: [
    { id: 'sample-doc-01', assetId: 'sample-crypto-x', kind: 'research', title: '示例资产 X · 研究摘记', asOf: '2026-01-07T10:00:00.000Z', sourceId: 'sample-private-archive', sourceUrl: null },
    { id: 'sample-doc-02', assetId: 'sample-crypto-x', kind: 'filing', title: '示例资产 X · 披露资料', asOf: '2026-01-06T10:00:00.000Z', sourceId: 'sample-disclosure', sourceUrl: null },
    { id: 'sample-doc-03', assetId: 'sample-u-x', kind: 'call', title: '示例公司 U · 电话会记录', asOf: '2026-01-07T10:00:00.000Z', sourceId: 'sample-call-archive', sourceUrl: null },
    { id: 'sample-doc-04', assetId: 'sample-u-x', kind: 'earnings', title: '示例公司 U · 财报摘要', asOf: '2026-01-06T10:00:00.000Z', sourceId: 'sample-earnings', sourceUrl: null },
    { id: 'sample-doc-05', assetId: 'sample-u-x', kind: 'filing', title: '示例公司 U · 披露资料', asOf: '2026-01-05T10:00:00.000Z', sourceId: 'sample-filing', sourceUrl: null }
  ], documentError: false,
  runs: runs.reverse().map(r => ({ runId: r.runId, startedAt: r.startedAt, finishedAt: r.finishedAt,
    sources: r.sources, observations: r.observations, observationCount: r.observations.length, alertCount: r.alerts.length })) };
await fs.writeFile(new URL('../public/sample.json', import.meta.url), JSON.stringify(state, null, 2) + '\n');
