# Cloudflare research desk pilot

This is a private Worker site backed by D1 and R2. The public repository contains source adapters and a generic deployment template. Keep the actual hostname, database IDs, R2 bucket, contact address, and any tokens in operator-owned configuration outside Git.

## Coverage

- Three US companies: SEC CompanyFacts annual and quarter facts, and the latest selected filing records from submissions. No equity prices or valuations.
- Two crypto pairs: archived completed Binance spot daily candles. The instrument directory can also search active Binance USDT spot pairs and request second, minute, hourly, daily, weekly, and monthly candles on demand. This is exchange-specific market data, not an aggregate price. The live detail page polls about every 15 seconds while visible; it is not a streaming feed.
- A-share, Hong Kong, licensed news, and private research inputs are explicitly unconnected. The site must never imply those markets are covered.
- One versioned system-design report demonstrates the private report library. R2 holds HTML artifacts; D1 stores metadata, stance, market tags, and instrument links. One report can link to several instruments, even when quote coverage is not yet connected.

The source list in `sources.js` is a bounded pilot, not a general market universe. Financial values preserve accession and filing dates so later corrections do not overwrite earlier records. The frontend selects the latest filed version per reporting period.

## Deployment

1. Create a Cloudflare Access self-hosted application for the private hostname, with an owner-only allow policy. Verify that unauthenticated requests to `/`, `/api/state`, and `/reports/<id>` redirect to Access before storing private data.
2. Create a D1 database and a private R2 bucket. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and replace all placeholders. The real config is ignored by Git.
3. Apply `schema.sql` with `wrangler d1 execute YOUR_D1_NAME --remote --file cloud/schema.sql`.
4. Set `SEC_USER_AGENT` as a Worker secret with a real operator contact address, following SEC guidance. Deploy with `wrangler deploy --config cloud/wrangler.jsonc`.
5. Optionally run `SEC_USER_AGENT='...' node cloud/seed.mjs /absolute/path/outside/repo.sql` for one-time backfill. Review the generated file, import it with `wrangler d1 execute YOUR_D1_NAME --remote --file /absolute/path/outside/repo.sql`, then remove it. The script never places source payloads inside Git.
6. Upload a reviewed HTML report to the private R2 bucket and insert its metadata into `reports`. Report pages inherit the same Access protection. The report artifact should refer only to self-hosted CSS and fonts; the Worker CSP blocks inline scripts.

For an existing installation, apply `cloud/migrations/0001-report-links.sql` before deploying the updated Worker. Do not apply that migration to a fresh database created with the current `schema.sql`.

To publish a report, copy `report-manifest.example.json` outside the repository and fill in the title, date, source count, stance (`bull`, `bear`, `neutral`, or `unrated`), markets, and zero or more instruments. Then run `node cloud/publish-report.mjs MANIFEST.json REPORT.html D1_DATABASE R2_BUCKET cloud/wrangler.jsonc` from the repository root. This uploads a content-addressed HTML artifact to R2 and inserts metadata and links into D1. Use a new report ID for a new published version. `unrated` is the correct value for system notes or reports without a directional conclusion. Instrument links use market plus uppercase symbol; `BTCUSDT` links to the Binance pair page, and `KO` links to the configured US company page.

Binance Spot [market-data-only documentation](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md) describes the public endpoints used for search, candles, and rolling 24-hour statistics. `dayOpen` and `previousClose` are UTC daily-candle values; the 24-hour figures are a rolling window. Turnover rate requires a circulating-supply denominator and is intentionally blank. The displayed buy/sell split derives from Binance kline taker-buy quote volume; it is not a stock-market capital-flow measure. US equities still have no price, intraday bar, or turnover provider in this pilot. A-share, Hong Kong, and licensed news coverage remain unconnected.

The Worker runs two scheduled checks in UTC: 00:30 every day and 09:30 Monday to Friday. It records each source's success or failure in `source_runs`. Schedule deployment alone does not prove future runs; confirm the next run in the site's operations view.

If a previously shared hostname needs to keep working after a rename, bind it as an additional custom domain and set `LEGACY_HOST` and `PRIMARY_HOST` privately. The Worker responds with a 308 redirect to the owner-protected current hostname without serving data on the old host.

## VPS workspace

The Cloudflare Worker handles the pilot's scheduled SEC and completed daily-candle checks. The VPS also runs `vps/market-api.mjs` on loopback for on-demand Binance search and price intervals. This is necessary because Binance's public host returns HTTP 403 to Cloudflare Worker egress in this deployment. The Worker calls the VPS through a separate Cloudflare Tunnel hostname protected by a service-token-only Access application and an origin token. The website itself remains protected by the owner's email-only Access application. The browser never sees either machine credential.

Keep the service under `/opt/market-research-desk/repo`, its environment file under `/opt/market-research-desk/private`, and logs in journald. `vps/market-data.service` is a systemd template. Bind the service only to `127.0.0.1`; expose it solely through the restricted tunnel route. Set Worker secrets `MARKET_DATA_URL`, `MARKET_DATA_CLIENT_ID`, `MARKET_DATA_CLIENT_SECRET`, and `MARKET_DATA_ORIGIN_TOKEN`; set the same origin token in the VPS environment file. The Cloudflare operator token must never be copied to the VPS. Live request failures return an unavailable state and do not silently fall back to old stored prices.

The separate VPS workspace remains available for longer parsing, event analysis, report builds, and local archives. Those later jobs need their own narrow write path and step status in the operations view.

## Data and privacy

The site is read-only over HTTP. It has no browser endpoint for source execution, report upload, or config changes. Only publish reports whose source rights and contents have been reviewed. See the [data availability](../docs/research/2026-10-30-data-and-decision-system.md) and [retention](../docs/research/2026-10-30-decision-workflow-storage-and-sites.md) studies for the reasoning behind the pilot boundary.
