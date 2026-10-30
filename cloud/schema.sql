CREATE TABLE IF NOT EXISTS source_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','ok','failed')),
  checked_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS source_runs_by_source ON source_runs(source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS financial_facts (
  asset_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('annual','quarter')),
  period_end TEXT NOT NULL,
  fiscal_year INTEGER,
  fiscal_period TEXT,
  filed_at TEXT NOT NULL,
  accession TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  source_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, metric, period_type, period_end, accession)
);
CREATE INDEX IF NOT EXISTS financial_facts_by_asset ON financial_facts(asset_id, metric, period_type, period_end DESC);

CREATE TABLE IF NOT EXISTS daily_bars (
  asset_id TEXT NOT NULL,
  day TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  quote_unit TEXT NOT NULL,
  source_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, day)
);
CREATE INDEX IF NOT EXISTS daily_bars_by_asset ON daily_bars(asset_id, day DESC);

CREATE TABLE IF NOT EXISTS filing_events (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  form TEXT NOT NULL,
  filed_at TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  captured_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS filing_events_by_date ON filing_events(filed_at DESC, asset_id);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  published_at TEXT NOT NULL,
  as_of TEXT NOT NULL,
  artifact_key TEXT NOT NULL UNIQUE,
  source_count INTEGER NOT NULL DEFAULT 0,
  stance TEXT NOT NULL DEFAULT 'unrated' CHECK (stance IN ('bull','bear','neutral','unrated'))
);

CREATE TABLE IF NOT EXISTS report_assets (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('a-share','hong-kong','us','crypto')),
  symbol TEXT NOT NULL,
  asset_id TEXT,
  PRIMARY KEY (report_id,market,symbol)
);
CREATE INDEX IF NOT EXISTS report_assets_by_asset ON report_assets(market,symbol,report_id);

CREATE TABLE IF NOT EXISTS report_markets (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  market TEXT NOT NULL CHECK (market IN ('a-share','hong-kong','us','crypto')),
  PRIMARY KEY (report_id,market)
);
