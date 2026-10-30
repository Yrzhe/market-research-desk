# Cloudflare research desk pilot

This is a private Worker site backed by D1 and R2. The public repository contains source adapters and a generic deployment template. Keep the actual hostname, database IDs, R2 bucket, contact address, and any tokens in operator-owned configuration outside Git.

## Coverage

- Three US companies: SEC CompanyFacts annual and quarter facts, and the latest selected filing records from submissions. No equity prices or valuations.
- Two crypto pairs: completed Binance spot daily candles. These are exchange-specific quotes, not an aggregate price.
- A-share, Hong Kong, licensed news, and private research inputs are explicitly unconnected. The site must never imply those markets are covered.
- One versioned system-design report demonstrates the private report library. R2 holds the HTML artifact; D1 stores its metadata.

The source list in `sources.js` is a bounded pilot, not a general market universe. Financial values preserve accession and filing dates so later corrections do not overwrite earlier records. The frontend selects the latest filed version per reporting period.

## Deployment

1. Create a Cloudflare Access self-hosted application for the private hostname, with an owner-only allow policy. Verify that unauthenticated requests to `/`, `/api/state`, and `/reports/<id>` redirect to Access before storing private data.
2. Create a D1 database and a private R2 bucket. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and replace all placeholders. The real config is ignored by Git.
3. Apply `schema.sql` with `wrangler d1 execute YOUR_D1_NAME --remote --file cloud/schema.sql`.
4. Set `SEC_USER_AGENT` as a Worker secret with a real operator contact address, following SEC guidance. Deploy with `wrangler deploy --config cloud/wrangler.jsonc`.
5. Optionally run `SEC_USER_AGENT='...' node cloud/seed.mjs /absolute/path/outside/repo.sql` for one-time backfill. Review the generated file, import it with `wrangler d1 execute YOUR_D1_NAME --remote --file /absolute/path/outside/repo.sql`, then remove it. The script never places source payloads inside Git.
6. Upload a reviewed HTML report to the private R2 bucket and insert its metadata into `reports`. Report pages inherit the same Access protection. The report artifact should refer only to self-hosted CSS and fonts; the Worker CSP blocks inline scripts.

The Worker runs two scheduled checks in UTC: 00:30 every day and 09:30 Monday to Friday. It records each source's success or failure in `source_runs`. Schedule deployment alone does not prove future runs; confirm the next run in the site's operations view.

## VPS workspace

The Cloudflare Worker handles this pilot's short source checks. A separate VPS workspace under `/opt/market-research-desk` is reserved for longer parsing, event analysis, report builds, and local archives. Keep all private configs, generated artifacts, and logs inside that project directory. Do not copy the broad Cloudflare operator token to the VPS. When VPS jobs are connected later, give them a narrow write path and show their step status in the operations view.

## Data and privacy

The site is read-only over HTTP. It has no browser endpoint for source execution, report upload, or config changes. Only publish reports whose source rights and contents have been reviewed. See the [data availability](../docs/research/2026-10-30-data-and-decision-system.md) and [retention](../docs/research/2026-10-30-decision-workflow-storage-and-sites.md) studies for the reasoning behind the pilot boundary.
