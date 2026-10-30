import fs from 'node:fs/promises';

// Fictional numbers exist only for the explicitly labelled visual preview.
const markets = [
  ['a-share', 'A 股市场广度', '上涨占比', '%', [47.2, 42.8, 39.4]],
  ['hong-kong', '港股市场成交', '主板成交额', 'HKD bn', [182.1, 176.4, 190.3]],
  ['us', '美股波动率', '波动率指数', 'pts', [17.8, 18.2, 21.1]],
  ['crypto', '加密市场市值', '总市值', 'USD bn', [2820, 2785, 2650]]
];
const days = ['2026-01-05', '2026-01-06', '2026-01-07'];
const marketClock = { 'a-share': '07:00:00', 'hong-kong': '08:00:00', us: '21:00:00', crypto: '00:00:00' };
const runs = days.map((day, i) => {
  const startedAt = `${day}T23:10:00.000Z`;
  const runId = `${day}T23-10-00-000Z-${String(i+1).padStart(6,'0')}`;
  const observations = markets.map(([market, sourceId, label, unit, values]) => ({
    market, sourceId, metricId: 'headline', label, value: values[i], unit,
    asOf: `${day}T${marketClock[market]}.000Z`, fetchedAt: startedAt
  }));
  const sources = markets.map(([market, id]) => ({ id, market, status: 'ok', fetchedAt: startedAt, count: 1, sourceUrl: null }));
  const alerts = i === 2 ? [{ id: 'sample-alert-01', market: 'crypto', sourceId: '加密市场市值', metricId: 'headline',
    label: '总市值', before: 2785, after: 2650, unit: 'USD bn', difference: -135,
    percent: (2650 - 2785) / 2785 * 100, beforeAsOf: `${days[1]}T00:00:00.000Z`, asOf: `${day}T00:00:00.000Z`,
    severity: 'review', status: 'unverified', formula: '(current - previous) / abs(previous) × 100' }] : [];
  return { schemaVersion: 1, runId, startedAt, finishedAt: startedAt, observations, alerts, sources, notifications: [] };
});
const newest = runs[2];
const state = { sample: true, generatedAt: '2026-01-07T23:12:00.000Z', latest: newest,
  markets: Object.fromEntries(markets.map(([market]) => [market, { status: 'ok', observation: newest.observations.find(o => o.market === market), observations: newest.observations.filter(o => o.market === market) }])),
  alerts: newest.alerts.map(a => ({ ...a, runId: newest.runId })),
  runs: runs.reverse().map(r => ({ runId: r.runId, startedAt: r.startedAt, finishedAt: r.finishedAt,
    sources: r.sources, observations: r.observations, observationCount: r.observations.length, alertCount: r.alerts.length })) };
await fs.writeFile(new URL('../public/sample.json', import.meta.url), JSON.stringify(state, null, 2) + '\n');
