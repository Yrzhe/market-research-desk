import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { collect, compare, dashboardState, extract, readRuns, readDecisions, sendNotifications } from '../src/core.js';

test('factual alerts require a newer comparable observation and are deduplicated', () => {
  const source = { id: 'test-source', metrics: [{ id: 'breadth', alertAbsolute: 5 }] };
  const prior = [{ market: 'us', sourceId: 'test-source', metricId: 'breadth', value: 40, unit: '%', asOf: '2026-01-01T00:00:00Z' }];
  const current = [{ ...prior[0], value: 47, asOf: '2026-01-02T00:00:00Z' }];
  const alerts = compare(current, prior, source);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].difference, 7);
  assert.equal(alerts[0].thresholds.absolute, 5);
  assert.equal(compare(current, prior, source, new Set([alerts[0].id])).length, 0);
  assert.equal(compare([{ ...current[0], asOf: prior[0].asOf }], prior, source).length, 0);
  assert.equal(compare([{ ...current[0], unit: 'USD' }], prior, source).length, 0);
});

test('missing fields do not become zero observations', () => {
  const source = { id: 'test-source', market: 'crypto', maxAgeMinutes: 2880, metrics: [
    { id: 'present', label: 'Present', path: 'data.present', unit: 'USD', asOfPath: 'data.time' },
    { id: 'missing', path: 'data.missing', unit: 'USD' }
  ] };
  const rows = extract(source, { data: { present: 0, time: '2026-01-01T00:00:00Z' } }, '2026-01-02T00:00:00Z');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 0);
  assert.equal(rows[0].asOf, '2026-01-01T00:00:00.000Z');
  assert.equal(rows[0].quality, 'valid');
  const stale = extract({ ...source, maxAgeMinutes: 60 }, { data: { present: 12, time: '2026-01-01T00:00:00Z' } }, '2026-01-02T00:00:00Z');
  assert.equal(stale[0].quality, 'stale');
  assert.equal(compare(stale, rows, { ...source, metrics: [{ id: 'present', alertAbsolute: 1 }] }).length, 0);
});

test('monitor archives immutable runs and leaves unconfigured sources explicit', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'market-desk-test-'));
  try {
    const config = { version: 1, sources: [{ id: 'unset-source', market: 'a-share', kind: 'http-json', urlEnv: 'MARKET_DESK_TEST_UNSET', headers: { Authorization: 'Bearer private-test-value' }, metrics: [] }] };
    const first = await collect(root, config);
    const second = await collect(root, config);
    assert.notEqual(first.runId, second.runId);
    assert.equal(first.sources[0].status, 'unconfigured');
    assert.equal(first.observations.length, 0);
    const runs = await readRuns(root);
    assert.equal(runs.length, 2);
    const state = await dashboardState(root);
    assert.equal(state.markets['a-share'].status, 'unconfigured');
    assert.equal(state.alerts.length, 0);
    const saved = await fs.readFile(path.join(root, 'runs', first.runId, 'run.json'), 'utf8');
    assert.equal(JSON.parse(saved).runId, first.runId);
    assert.ok(!saved.includes('private-test-value'));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('configured local script produces a sourced current observation', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'market-desk-stale-'));
  try {
    const config = { version: 1, sources: [{ id: 'local', market: 'crypto', kind: 'command', command: 'example.mjs',
      maxAgeMinutes: 1, metrics: [{ id: 'example', path: 'example_index', asOfPath: 'observed_at', unit: 'pts' }] }] };
    const run = await collect(root, config);
    assert.equal(run.sources[0].status, 'ok');
    const state = await dashboardState(root);
    assert.equal(state.markets.crypto.observations.length, 1);
    assert.equal(state.markets.crypto.observations[0].value, 100);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('webhook receives alert identifiers without a credential in the body', async () => {
  let captured;
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => { captured = { body, authorization: request.headers.authorization }; response.writeHead(204).end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = { url: process.env.ALERT_WEBHOOK_URL, bearer: process.env.ALERT_WEBHOOK_BEARER, telegram: process.env.TELEGRAM_BOT_TOKEN };
  try {
    process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${server.address().port}/hook`;
    process.env.ALERT_WEBHOOK_BEARER = 'test-secret-do-not-copy';
    delete process.env.TELEGRAM_BOT_TOKEN;
    const results = await sendNotifications([{ id: 'alert-123' }], 'run-123');
    assert.equal(results[0].status, 'sent');
    assert.equal(captured.authorization, 'Bearer test-secret-do-not-copy');
    assert.deepEqual(JSON.parse(captured.body).alertIds, ['alert-123']);
    assert.ok(!captured.body.includes('test-secret-do-not-copy'));
  } finally {
    if (previous.url === undefined) delete process.env.ALERT_WEBHOOK_URL; else process.env.ALERT_WEBHOOK_URL = previous.url;
    if (previous.bearer === undefined) delete process.env.ALERT_WEBHOOK_BEARER; else process.env.ALERT_WEBHOOK_BEARER = previous.bearer;
    if (previous.telegram === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = previous.telegram;
    await new Promise(resolve => server.close(resolve));
  }
});

test('private decision export is read-only and malformed records are isolated', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'market-desk-decisions-'));
  try {
    const valid = { id: 'test-decision', market: 'us', asset: 'Example', verdict: 'insufficient evidence', asOf: '2026-01-01T00:00:00Z', reviewAt: '2026-01-02T00:00:00Z', apiToken: 'must-not-reach-browser' };
    const file = path.join(root, 'decisions.jsonl');
    await fs.writeFile(file, JSON.stringify(valid) + '\n{broken json}\n');
    const before = await fs.readFile(file, 'utf8');
    const result = await readDecisions(root);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, 'test-decision');
    assert.ok(!JSON.stringify(result.items).includes('must-not-reach-browser'));
    assert.equal(result.error, true);
    assert.equal(await fs.readFile(file, 'utf8'), before);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('webhook refuses cleartext delivery to a remote host', async () => {
  const prior = process.env.ALERT_WEBHOOK_URL;
  try {
    process.env.ALERT_WEBHOOK_URL = 'http://example.com/hook';
    const result = await sendNotifications([{ id: 'alert-remote' }], 'run-remote', ['webhook']);
    assert.equal(result[0].status, 'failed');
  } finally {
    if (prior === undefined) delete process.env.ALERT_WEBHOOK_URL; else process.env.ALERT_WEBHOOK_URL = prior;
  }
});
