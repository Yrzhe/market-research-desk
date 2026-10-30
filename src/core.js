import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export const markets = ['a-share', 'hong-kong', 'us', 'crypto'];

export function dataDir() { return path.resolve(process.env.DATA_DIR || './data'); }

export function getPath(value, dotted) {
  return dotted?.split('.').reduce((part, key) => part?.[key], value);
}

function requiredEnv(name) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Invalid environment variable name');
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is unset`);
  return value;
}

function interpolate(value) {
  return value.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_, name) => requiredEnv(name));
}

export async function readConfig() {
  const file = path.resolve(process.env.CONFIG_PATH || './config/example.json');
  let config;
  try { config = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { throw new Error('Configuration file could not be read or parsed'); }
  if (config.version !== 1 || !Array.isArray(config.sources)) throw new Error('Invalid config version or sources');
  const ids = new Set();
  for (const source of config.sources) {
    if (!/^[a-z0-9-]+$/.test(source.id) || ids.has(source.id)) throw new Error('Invalid or duplicate source ID');
    ids.add(source.id);
    if (!markets.includes(source.market) || !['http-json', 'command'].includes(source.kind)) throw new Error(`Invalid source ${source.id}`);
    if (!Array.isArray(source.metrics)) throw new Error(`Missing metrics in ${source.id}`);
    if (source.metrics.length && !(source.maxAgeMinutes > 0)) throw new Error(`Source ${source.id} needs maxAgeMinutes`);
    for (const metric of source.metrics) {
      if (!/^[a-z0-9-]+$/.test(metric.id) || !metric.path || !metric.unit) throw new Error(`Invalid metric in ${source.id}`);
      if (metric.alertPercent != null && !(metric.alertPercent > 0)) throw new Error(`Invalid threshold in ${source.id}`);
      if (metric.alertAbsolute != null && !(metric.alertAbsolute > 0)) throw new Error(`Invalid threshold in ${source.id}`);
    }
  }
  return config;
}

async function runCommand(source) {
  if (!/^[a-zA-Z0-9._-]+\.mjs$/.test(source.command || '')) throw new Error('Command must be a local .mjs filename');
  const file = path.resolve('scripts/monitors', source.command);
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Monitor timeout')); }, 15000);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 1024 * 1024) child.kill(); });
    child.on('error', () => { clearTimeout(timer); reject(new Error('Monitor failed')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 || output.length > 1024 * 1024) return reject(new Error('Monitor failed or response too large'));
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Monitor returned invalid JSON')); }
    });
  });
}

async function fetchSource(source) {
  if (source.kind === 'command') return runCommand(source);
  const rawUrl = requiredEnv(source.urlEnv);
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Source URL must be HTTPS without embedded credentials');
  const headers = {};
  for (const [key, value] of Object.entries(source.headers || {})) {
    if (!/^[a-zA-Z0-9-]+$/.test(key)) throw new Error('Invalid header name');
    // Optional example header is omitted until the credential is configured.
    if (/\$\{([A-Z][A-Z0-9_]*)\}/.test(value) && !process.env[value.match(/\$\{([A-Z][A-Z0-9_]*)\}/)[1]]) continue;
    headers[key] = interpolate(value);
  }
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  if (Number(response.headers.get('content-length') || 0) > 1024 * 1024) throw new Error('Source response too large');
  const body = await response.text();
  if (body.length > 1024 * 1024) throw new Error('Source response too large');
  return JSON.parse(body);
}

export function extract(source, body, fetchedAt) {
  const observations = [];
  for (const metric of source.metrics) {
    const value = getPath(body, metric.path);
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const asOfRaw = getPath(body, metric.asOfPath) ?? fetchedAt;
    const asOf = typeof asOfRaw === 'number' ? new Date(asOfRaw * 1000).toISOString() : new Date(asOfRaw).toISOString();
    const ageMinutes = (Date.parse(fetchedAt) - Date.parse(asOf)) / 60000;
    const quality = source.maxAgeMinutes && (ageMinutes > source.maxAgeMinutes || ageMinutes < -5) ? 'stale' : 'valid';
    observations.push({ market: source.market, sourceId: source.id, metricId: metric.id,
      label: metric.label || metric.id, value, unit: metric.unit, asOf, fetchedAt, quality });
  }
  return observations;
}

async function listRuns(root) {
  try { return (await fs.readdir(path.join(root, 'runs'))).filter(name => /^[0-9a-fTZ-]+$/.test(name)).sort().reverse(); }
  catch { return []; }
}

export async function readRuns(root = dataDir(), limit = 20) {
  const names = (await listRuns(root)).slice(0, limit);
  const runs = [];
  for (const name of names) {
    try { runs.push(JSON.parse(await fs.readFile(path.join(root, 'runs', name, 'run.json'), 'utf8'))); }
    catch { /* Ignore partial external files. */ }
  }
  return runs;
}

export async function readDecisions(root = dataDir()) {
  let content;
  try { content = await fs.readFile(path.join(root, 'decisions.jsonl'), 'utf8'); }
  catch (error) { return { items: [], error: error.code !== 'ENOENT' }; }
  const items = [];
  let error = false;
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const item = JSON.parse(line);
      if (typeof item.id !== 'string' || !item.id || !markets.includes(item.market) ||
          typeof item.asset !== 'string' || !item.asset || typeof item.verdict !== 'string' || !item.verdict ||
          typeof item.asOf !== 'string' || Number.isNaN(Date.parse(item.asOf)) ||
          (item.reviewAt && (typeof item.reviewAt !== 'string' || Number.isNaN(Date.parse(item.reviewAt)))) ||
          (item.verifiedAt && (typeof item.verifiedAt !== 'string' || Number.isNaN(Date.parse(item.verifiedAt))))) throw new Error('Invalid decision');
      // Explicitly allowlist browser-visible fields. Private exports may carry account data.
      items.push({ id: String(item.id), market: item.market, asset: String(item.asset),
        verdict: String(item.verdict), asOf: item.asOf,
        price: typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : null,
        currency: item.currency ? String(item.currency) : null,
        horizon: item.horizon ? String(item.horizon) : null,
        thesis: item.thesis ? String(item.thesis) : null,
        counterEvidence: item.counterEvidence ? String(item.counterEvidence) : null,
        invalidatedBy: item.invalidatedBy ? String(item.invalidatedBy) : null,
        reviewAt: item.reviewAt || null, verifiedAt: item.verifiedAt || null,
        evidenceRunIds: Array.isArray(item.evidenceRunIds) ? item.evidenceRunIds.filter(v => typeof v === 'string').slice(0, 20) : [] });
    } catch { error = true; }
  }
  items.sort((a, b) => b.asOf.localeCompare(a.asOf));
  return { items: items.slice(0, 100), error };
}

export function compare(current, previous, source, existingAlertIds = new Set()) {
  const alerts = [];
  for (const item of current) {
    const metric = source.metrics.find(m => m.id === item.metricId);
    if (item.quality === 'stale') continue;
    const old = previous.find(p => p.sourceId === item.sourceId && p.metricId === item.metricId && p.unit === item.unit && p.quality !== 'stale');
    if (!old || old.asOf >= item.asOf) continue;
    const difference = item.value - old.value;
    const percent = old.value === 0 ? null : difference / Math.abs(old.value) * 100;
    const hit = (metric.alertAbsolute != null && Math.abs(difference) >= metric.alertAbsolute) ||
      (metric.alertPercent != null && percent != null && Math.abs(percent) >= metric.alertPercent);
    if (!hit) continue;
    const id = crypto.createHash('sha256').update(`${source.id}|${metric.id}|${item.asOf}|${item.value}|${old.asOf}`).digest('hex').slice(0, 16);
    if (existingAlertIds.has(id)) continue;
    alerts.push({ id, market: item.market, sourceId: source.id, metricId: item.metricId,
      label: item.label, before: old.value, after: item.value, unit: item.unit, difference, percent,
      beforeAsOf: old.asOf, asOf: item.asOf, severity: 'review', status: 'unverified',
      thresholds: { absolute: metric.alertAbsolute ?? null, percent: metric.alertPercent ?? null },
      formula: percent == null ? 'current - previous' : '(current - previous) / abs(previous) × 100' });
  }
  return alerts;
}

export async function sendNotifications(alerts, runId, channels = ['telegram', 'webhook']) {
  if (!alerts.length) return [];
  const results = [];
  const base = process.env.PUBLIC_DASHBOARD_URL || '';
  const ids = alerts.slice(0, 10).map(a => a.id).join(', ');
  const message = `${alerts.length} market observation(s) need review. Alert ID: ${ids}${alerts.length > 10 ? ' …' : ''}. Run ${runId}${base ? ` ${base}` : ''}. No investment conclusion was generated.`;
  if (channels.includes('telegram') && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message }), signal: AbortSignal.timeout(10000)
      });
      results.push({ channel: 'telegram', status: response.ok ? 'sent' : 'failed', code: response.status });
    } catch { results.push({ channel: 'telegram', status: 'failed' }); }
  }
  if (channels.includes('webhook') && process.env.ALERT_WEBHOOK_URL) {
    try {
      const endpoint = new URL(process.env.ALERT_WEBHOOK_URL);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
      if ((endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && local)) || endpoint.username || endpoint.password) {
        throw new Error('Webhook URL must use HTTPS without embedded credentials');
      }
      const headers = { 'content-type': 'application/json' };
      if (process.env.ALERT_WEBHOOK_BEARER) headers.authorization = `Bearer ${process.env.ALERT_WEBHOOK_BEARER}`;
      const response = await fetch(endpoint, { method: 'POST', headers,
        body: JSON.stringify({ runId, alertIds: alerts.map(a => a.id), message, url: base }), signal: AbortSignal.timeout(10000) });
      results.push({ channel: 'webhook', status: response.ok ? 'sent' : 'failed', code: response.status });
    } catch { results.push({ channel: 'webhook', status: 'failed' }); }
  }
  return results;
}

export async function collect(root = dataDir(), config) {
  config ??= await readConfig();
  const startedAt = new Date().toISOString();
  const runId = startedAt.replace(/[:.]/g, '-').replace(/Z$/, 'Z') + '-' + crypto.randomBytes(3).toString('hex');
  const prior = await readRuns(root, Infinity);
  const previous = prior.flatMap(run => run.observations || []);
  const existingAlertIds = new Set(prior.flatMap(run => (run.alerts || []).map(a => a.id)));
  const observations = [], alerts = [], sources = [];
  for (const source of config.sources) {
    const definition = { kind: source.kind, maxAgeMinutes: source.maxAgeMinutes || null,
      metrics: source.metrics.map(metric => ({ id: metric.id, label: metric.label || metric.id,
        path: metric.path, asOfPath: metric.asOfPath || null, unit: metric.unit,
        alertAbsolute: metric.alertAbsolute ?? null, alertPercent: metric.alertPercent ?? null })) };
    if (source.kind === 'http-json' && !process.env[source.urlEnv]) {
      sources.push({ id: source.id, market: source.market, status: 'unconfigured', definition });
      continue;
    }
    try {
      const body = await fetchSource(source);
      const fetchedAt = new Date().toISOString();
      const items = extract(source, body, fetchedAt);
      observations.push(...items);
      const validItems = items.filter(item => item.quality !== 'stale');
      alerts.push(...compare(validItems, previous, source, existingAlertIds));
      const raw = source.kind === 'http-json' ? process.env[source.urlEnv] : null;
      const sourceUrl = raw ? new URL(raw) : null;
      let publicUrl = null;
      if (source.publicUrl) {
        const candidate = new URL(source.publicUrl);
        if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) {
          candidate.search = '';
          candidate.hash = '';
          publicUrl = candidate.toString();
        }
      }
      sources.push({ id: source.id, market: source.market, status: validItems.length ? 'ok' : items.length ? 'stale' : 'missing',
        fetchedAt, count: items.length, validCount: validItems.length, sourceUrl: publicUrl || sourceUrl?.origin || null, definition });
    } catch (error) {
      // Do not persist raw exception text; URLs and credentials may appear there.
      sources.push({ id: source.id, market: source.market, status: 'failed', error: error.message.startsWith('Source returned HTTP') ? error.message : 'Collection failed', definition });
    }
  }
  const run = { schemaVersion: 1, runId, startedAt, finishedAt: new Date().toISOString(),
    observations, alerts, sources };
  const runsPath = path.join(root, 'runs');
  await fs.mkdir(runsPath, { recursive: true, mode: 0o700 });
  const temp = await fs.mkdtemp(path.join(runsPath, '.pending-'));
  try {
    await fs.writeFile(path.join(temp, 'run.json'), JSON.stringify(run, null, 2) + '\n', { mode: 0o600 });
    await fs.rename(temp, path.join(runsPath, runId));
  } catch (error) { await fs.rm(temp, { recursive: true, force: true }); throw error; }
  const notificationResults = await sendNotifications(alerts, runId);
  // Delivery is operational metadata, separate from the immutable evidence package.
  if (notificationResults.length) await fs.writeFile(path.join(root, 'delivery-' + runId + '.json'), JSON.stringify(notificationResults) + '\n', { mode: 0o600 });
  return { ...run, notifications: notificationResults };
}

export async function retryNotifications(root = dataDir()) {
  const runs = await readRuns(root, Infinity);
  const outcomes = [];
  for (const run of runs.filter(r => r.alerts?.length)) {
    const file = path.join(root, 'delivery-' + run.runId + '.json');
    let previous = [];
    try { previous = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
    const channels = ['telegram', 'webhook'].filter(channel => !previous.some(result => result.channel === channel && result.status === 'sent'));
    if (!channels.length) continue;
    const current = await sendNotifications(run.alerts, run.runId, channels);
    if (!current.length) continue;
    const merged = [...previous.filter(p => !current.some(c => c.channel === p.channel)), ...current];
    const temp = file + '.pending';
    await fs.writeFile(temp, JSON.stringify(merged) + '\n', { mode: 0o600 });
    await fs.rename(temp, file);
    outcomes.push({ runId: run.runId, results: current });
  }
  return outcomes;
}

export async function dashboardState(root = dataDir()) {
  const runs = await readRuns(root, 50);
  const decisions = await readDecisions(root);
  const latest = runs[0] || null;
  const latestByMarket = Object.fromEntries(markets.map(market => {
    const observation = runs.flatMap(r => r.observations || []).find(o => o.market === market && o.quality !== 'stale');
    const sources = latest?.sources?.filter(s => s.market === market) || [];
    const status = ['ok', 'stale', 'failed', 'missing', 'unconfigured'].find(candidate => sources.some(s => s.status === candidate)) || 'unconfigured';
    const validSourceIds = new Set(sources.filter(s => s.status === 'ok').map(s => s.id));
    return [market, { status, observation: observation || null,
      observations: latest?.observations?.filter(o => o.market === market && o.quality !== 'stale' && validSourceIds.has(o.sourceId)) || [] }];
  }));
  return { generatedAt: new Date().toISOString(), latest, markets: latestByMarket,
    alerts: runs.flatMap(r => (r.alerts || []).map(a => ({ ...a, runId: r.runId }))).slice(0, 100),
    decisions: decisions.items, decisionError: decisions.error,
    runs: runs.map(r => ({ runId: r.runId, startedAt: r.startedAt, finishedAt: r.finishedAt,
      sources: r.sources, observations: r.observations, observationCount: r.observations.length, alertCount: r.alerts.length })) };
}
