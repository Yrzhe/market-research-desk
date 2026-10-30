// One-time remote backfill. Writes SQL to a caller-chosen path outside the repository.
// Use `wrangler d1 execute market-research-desk-db --remote --file <path>` after review.
import fs from 'node:fs/promises';
import path from 'node:path';
import { assets, collectAsset } from './sources.js';

const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error('Pass an absolute output SQL path');
if (output.startsWith(path.resolve('.') + path.sep)) throw new Error('Write generated data outside the repository');

function q(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number');
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, columns, values, verb = 'INSERT OR IGNORE') {
  return `${verb} INTO ${table} (${columns.join(',')}) VALUES (${values.map(q).join(',')});`;
}

// Wrangler's remote D1 import handles the batch; explicit SQL transactions are rejected.
const lines = [];
for (const asset of assets) {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  let result;
  let status = 'ok';
  let error = null;
  try { result = await collectAsset(asset, process.env.SEC_USER_AGENT); }
  catch (cause) { status = 'failed'; error = String(cause?.message || cause).slice(0, 180); result = { facts: [], bars: [], filings: [] }; }
  for (const f of result.facts) lines.push(insert('financial_facts',
    ['asset_id','metric','period_type','period_end','fiscal_year','fiscal_period','filed_at','accession','value','unit','source_url','captured_at'],
    [f.assetId,f.metric,f.periodType,f.periodEnd,f.fiscalYear,f.fiscalPeriod,f.filedAt,f.accession,f.value,f.unit,f.sourceUrl,f.capturedAt]));
  for (const b of result.bars) lines.push(insert('daily_bars',
    ['asset_id','day','open','high','low','close','volume','quote_unit','source_url','captured_at'],
    [b.assetId,b.day,b.open,b.high,b.low,b.close,b.volume,b.quoteUnit,b.sourceUrl,b.capturedAt], 'INSERT OR REPLACE'));
  for (const e of result.filings) lines.push(insert('filing_events',
    ['id','asset_id','form','filed_at','title','source_url','captured_at'],
    [e.id,e.assetId,e.form,e.filedAt,e.title,e.sourceUrl,e.capturedAt]));
  lines.push(insert('source_runs',
    ['id','source_id','started_at','finished_at','status','checked_count','error'],
    [id,asset.sourceId,startedAt,new Date().toISOString(),status,result.facts.length+result.bars.length+result.filings.length,error]));
  process.stderr.write(`${asset.sourceId}: ${status}; facts=${result.facts.length} bars=${result.bars.length} filings=${result.filings.length}${error ? `; ${error}` : ''}\n`);
}
await fs.writeFile(output, lines.join('\n') + '\n', { mode: 0o600 });
process.stderr.write(`Prepared ${lines.length} SQL statements at ${output}\n`);
