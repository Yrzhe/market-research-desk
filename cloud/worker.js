import { assets, markets, collectAsset } from './sources.js';

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};

function respond(body, status = 200, contentType = 'application/json; charset=utf-8') {
  return new Response(body, { status, headers: { ...securityHeaders, 'content-type': contentType, 'cache-control': 'no-store' } });
}

function json(data, status = 200) { return respond(JSON.stringify(data), status); }

async function readState(db) {
  // This pilot reads a deliberately bounded universe. Broader coverage needs pagination.
  const facts = (await db.prepare("SELECT * FROM financial_facts WHERE period_end >= '2018-01-01' ORDER BY period_end DESC, filed_at DESC LIMIT 750").all()).results;
  const bars = (await db.prepare("SELECT * FROM daily_bars WHERE day >= date('now','-120 day') ORDER BY day ASC LIMIT 500").all()).results;
  const events = (await db.prepare('SELECT * FROM filing_events ORDER BY filed_at DESC LIMIT 100').all()).results;
  const runs = (await db.prepare('SELECT * FROM source_runs ORDER BY started_at DESC LIMIT 60').all()).results;
  const reports = (await db.prepare('SELECT id,title,description,published_at,as_of,source_count FROM reports ORDER BY published_at DESC LIMIT 100').all()).results;
  return { generatedAt: new Date().toISOString(), pilot: true, markets, assets: assets.map(({ cik, pair, ...publicAsset }) => publicAsset), facts, bars, events, runs, reports };
}

function factStatements(db, facts) {
  return facts.map(f => db.prepare(`INSERT OR IGNORE INTO financial_facts
    (asset_id,metric,period_type,period_end,fiscal_year,fiscal_period,filed_at,accession,value,unit,source_url,captured_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      f.assetId, f.metric, f.periodType, f.periodEnd, f.fiscalYear, f.fiscalPeriod,
      f.filedAt, f.accession, f.value, f.unit, f.sourceUrl, f.capturedAt
    ));
}

function barStatements(db, bars) {
  return bars.map(b => db.prepare(`INSERT INTO daily_bars
    (asset_id,day,open,high,low,close,volume,quote_unit,source_url,captured_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(asset_id,day) DO UPDATE SET
      open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,
      volume=excluded.volume,source_url=excluded.source_url,captured_at=excluded.captured_at`).bind(
      b.assetId, b.day, b.open, b.high, b.low, b.close, b.volume,
      b.quoteUnit, b.sourceUrl, b.capturedAt
    ));
}

function filingStatements(db, filings) {
  return filings.map(e => db.prepare(`INSERT OR IGNORE INTO filing_events
    (id,asset_id,form,filed_at,title,source_url,captured_at) VALUES (?,?,?,?,?,?,?)`).bind(
      e.id, e.assetId, e.form, e.filedAt, e.title, e.sourceUrl, e.capturedAt
    ));
}

export async function runSource(asset, env) {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await env.DB.prepare('INSERT INTO source_runs (id,source_id,started_at,status) VALUES (?,?,?,?)')
    .bind(id, asset.sourceId, startedAt, 'running').run();
  try {
    const result = await collectAsset(asset, env.SEC_USER_AGENT);
    const statements = [
      ...factStatements(env.DB, result.facts),
      ...barStatements(env.DB, result.bars),
      ...filingStatements(env.DB, result.filings)
    ];
    // Keep the pilot's source writes and success marker in one atomic D1 batch.
    if (statements.length > 249) throw new Error('Source exceeds pilot batch limit');
    const finish = env.DB.prepare('UPDATE source_runs SET status=?,finished_at=?,checked_count=? WHERE id=?')
      .bind('ok', new Date().toISOString(), statements.length, id);
    await env.DB.batch([...statements, finish]);
  } catch (error) {
    const message = String(error?.message || 'Source failed').slice(0, 180);
    await env.DB.prepare('UPDATE source_runs SET status=?,finished_at=?,error=? WHERE id=?')
      .bind('failed', new Date().toISOString(), message, id).run();
  }
}

export async function runAllSources(env) {
  for (const asset of assets) await runSource(asset, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return respond('Method not allowed', 405, 'text/plain; charset=utf-8');
    try {
      if (url.pathname === '/api/state') return json(await readState(env.DB));
      if (url.pathname === '/api/health') return json({ status: 'ok', at: new Date().toISOString() });
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
      if (url.pathname.startsWith('/reports/')) {
        const slug = url.pathname.slice('/reports/'.length);
        if (!/^[a-z0-9-]+$/.test(slug)) return respond('Not found', 404, 'text/plain; charset=utf-8');
        const report = await env.DB.prepare('SELECT artifact_key FROM reports WHERE id=?').bind(slug).first();
        if (!report) return respond('Not found', 404, 'text/plain; charset=utf-8');
        const object = await env.REPORTS.get(report.artifact_key);
        if (!object) return respond('Report unavailable', 503, 'text/plain; charset=utf-8');
        return new Response(object.body, { headers: { ...securityHeaders, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, max-age=300' } });
      }
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      for (const [key, value] of Object.entries(securityHeaders)) headers.set(key, value);
      if (url.pathname === '/' || url.pathname.endsWith('.html')) headers.set('cache-control', 'no-store');
      return new Response(asset.body, { status: asset.status, headers });
    } catch {
      if (url.pathname.startsWith('/api/')) return json({ error: 'Data unavailable' }, 503);
      return respond('Unable to load page', 503, 'text/plain; charset=utf-8');
    }
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(runAllSources(env)); }
};
