#!/usr/bin/env node
// Publish a reviewed HTML report with explicit stance, market, and instrument links.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [manifestPath, htmlPath, database, bucket, config = 'cloud/wrangler.jsonc', mode = '--remote'] = process.argv.slice(2);
if (![manifestPath, htmlPath, database, bucket].every(Boolean)) {
  console.error('Usage: node cloud/publish-report.mjs MANIFEST.json REPORT.html D1_DATABASE R2_BUCKET [WRANGLER_CONFIG] [--remote|--local]');
  process.exit(2);
}
if (!['--remote','--local'].includes(mode)) throw new Error('Mode must be --remote or --local');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const html = await readFile(htmlPath);
const markets = new Set(['a-share','hong-kong','us','crypto']);
const stances = new Set(['bull','bear','neutral','unrated']);
const required = ['id','title','description','publishedAt','asOf','sourceCount','stance'];
if (required.some(key => manifest[key] == null) || !/^[a-z0-9-]{3,80}$/.test(manifest.id) || !stances.has(manifest.stance)) throw new Error('Invalid report fields');
if (!Number.isInteger(manifest.sourceCount) || manifest.sourceCount < 0) throw new Error('Invalid sourceCount');
if (Number.isNaN(Date.parse(manifest.publishedAt)) || Number.isNaN(Date.parse(manifest.asOf))) throw new Error('Invalid report dates');
if (typeof manifest.title !== 'string' || typeof manifest.description !== 'string' || manifest.title.length > 300 || manifest.description.length > 1200) throw new Error('Invalid report text');
if (!Array.isArray(manifest.markets) || !manifest.markets.every(m => markets.has(m))) throw new Error('Invalid market tags');
if (!Array.isArray(manifest.assets) || !manifest.assets.every(a => markets.has(a.market) && typeof a.symbol === 'string' && /^[A-Za-z0-9.\-/]{1,30}$/.test(a.symbol))) throw new Error('Invalid asset links');
if (!html.toString('utf8').includes('<html') || /<script\b/i.test(html.toString('utf8'))) throw new Error('Report must be HTML without scripts');
const artifactKey = `reports/${manifest.id}-${createHash('sha256').update(html).digest('hex').slice(0,16)}.html`;
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const lines = [
  `INSERT INTO reports (id,title,description,published_at,as_of,artifact_key,source_count,stance) VALUES (${[manifest.id,manifest.title,manifest.description,manifest.publishedAt,manifest.asOf,artifactKey,manifest.sourceCount,manifest.stance].map(q).join(',')});`,
  ...[...new Set(manifest.markets)].map(m => `INSERT INTO report_markets (report_id,market) VALUES (${q(manifest.id)},${q(m)});`),
  ...manifest.assets.map(a => `INSERT INTO report_assets (report_id,market,symbol,asset_id) VALUES (${q(manifest.id)},${q(a.market)},${q(a.symbol.toUpperCase().replace('/',''))},${a.assetId ? q(a.assetId) : 'NULL'});`)];
const sqlPath = join(tmpdir(), `research-report-${process.pid}.sql`);
await writeFile(sqlPath, lines.join('\n'), { mode: 0o600 });
function run(args) {
  const result = spawnSync('wrangler', args, { stdio:'inherit' });
  if (result.status !== 0) throw new Error(`wrangler failed: ${args.slice(0,3).join(' ')}`);
}
try {
  run(['r2','object','put',`${bucket}/${artifactKey}`,'--file',htmlPath,mode,'--content-type','text/html; charset=utf-8','--config',config]);
  run(['d1','execute',database,mode,'--file',sqlPath,'--config',config,'--yes']);
  console.log(`Published /reports/${manifest.id} with ${manifest.assets.length} instrument links`);
} finally { await unlink(sqlPath).catch(()=>{}); }
