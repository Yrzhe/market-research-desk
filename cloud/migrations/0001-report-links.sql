ALTER TABLE reports ADD COLUMN stance TEXT NOT NULL DEFAULT 'unrated' CHECK (stance IN ('bull','bear','neutral','unrated'));
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
