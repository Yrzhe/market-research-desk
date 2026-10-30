import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCompany, collectCrypto } from '../cloud/sources.js';

const capturedAt = '2026-10-30T16:00:00Z';

test('SEC collector keeps filing versions and excludes cumulative quarters', async () => {
  const company = { id: 'test', cik: '0000000001', kind: 'equity' };
  const fact = { units: { USD: [
    { start: '2024-01-01', end: '2024-12-31', val: 100, form: '10-K', fp: 'FY', fy: 2024, accn: '000-01', filed: '2025-02-01' },
    { start: '2024-01-01', end: '2024-12-31', val: 105, form: '10-K', fp: 'FY', fy: 2024, accn: '000-02', filed: '2025-03-01' },
    { start: '2025-01-01', end: '2025-03-31', val: 30, form: '10-Q', fp: 'Q1', fy: 2025, accn: '000-03', filed: '2025-05-01' },
    { start: '2025-01-01', end: '2025-06-30', val: 70, form: '10-Q', fp: 'Q2', fy: 2025, accn: '000-04', filed: '2025-08-01' }
  ] } };
  const mockFetch = async url => new Response(JSON.stringify(url.includes('companyfacts')
    ? { facts: { 'us-gaap': { Revenues: fact } } }
    : { filings: { recent: { form: ['8-K'], accessionNumber: ['000-05'], primaryDocument: ['event.htm'], filingDate: ['2026-10-15'], primaryDocDescription: ['Material event'] } } }),
  { status: 200, headers: { 'content-type': 'application/json' } });
  const result = await collectCompany(company, 'Research Desk contact@example.com', mockFetch, capturedAt);
  assert.deepEqual(result.facts.map(row => [row.periodType, row.value, row.accession]), [
    ['annual', 100, '000-01'], ['annual', 105, '000-02'], ['quarter', 30, '000-03']
  ]);
  assert.equal(result.filings[0].sourceUrl, 'https://www.sec.gov/Archives/edgar/data/1/00005/event.htm');
  assert.equal(result.facts[0].capturedAt, capturedAt);
});

test('crypto collector only stores completed finite daily candles', async () => {
  const closed = Date.parse('2026-10-29T23:59:59Z');
  const future = Date.now() + 86_400_000;
  const mockFetch = async () => new Response(JSON.stringify([
    [Date.parse('2026-10-29T00:00:00Z'), '10', '12', '9', '11', '100', closed],
    [Date.parse('2026-10-30T00:00:00Z'), '11', '14', '10', '13', '110', future],
    [Date.parse('2026-10-28T00:00:00Z'), 'x', '12', '9', '11', '100', closed]
  ]), { status: 200 });
  const result = await collectCrypto({ id: 'btc', pair: 'BTCUSDT' }, mockFetch, capturedAt);
  assert.deepEqual(result.bars.map(row => [row.day, row.close, row.quoteUnit]), [['2026-10-29', 11, 'USDT']]);
  assert.equal(result.bars[0].capturedAt, capturedAt);
});
