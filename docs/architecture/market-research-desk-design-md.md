# Market Research Desk — Design MD

## Brief and scope

An open-source read-only research desk for four markets. A private deployment runs configurable monitors, retains dated factual evidence, and surfaces factual alerts for a human research decision. Public source contains no personal holdings, research archive, recipients, credentials, or live market data.

Surface: app screen. The overview answers: **What changed since the last valid observation, and what needs investigation?** With no configured source, its honest finding is that no market has been connected. The primary job is to inspect an alert and its evidence; secondary jobs are checking source health and prior runs.

## Inventory

- Markets: A shares, Hong Kong, US, and crypto, each with its own observation timestamp and time zone.
- A monitor reports numeric observations with unit, source URL, as-of time and capture time.
- An optional asset registry gives a market, stable ID, symbol, name and venue. A metric may link to one asset; market-wide metrics remain separate.
- A rule compares a current observation with the preceding compatible one and emits a factual alert.
- An alert has a stable ID, severity, status, calculation, and a link to its immutable run.
- A run has an ID, trigger, start and end time, per-source outcomes, and data quality.
- Decisions are research artifacts added by a separate private process; the monitor does not infer buy or sell actions.
- A private document index links report, filing, financial statement and call metadata to an asset by ID; the app does not serve report contents.
- A new installation typically has zero observations, zero alerts and four unconnected markets.
- The daily reader uses desktop for comparison and a phone for alerts and status.
- The product's own object is an evidence trail: observation → comparison → alert → research decision.

## Direction and reference lock

The first pass used taste-skill `achromatic-ledger`, seed `1152222347`. Its screenshot was still a generic light admin: separate white panels gave the market data, evidence and operations equal visual weight. The second pass uses the `framed-sheet` app direction, seed `519901950`, while keeping the factual scope. A neutral rail frames one work sheet. The four-market tape stays quiet; the current investigation is the one dark, high-contrast data surface. This gives the screen a clear place to start without decorative imagery or invented market data. The asset directory adds a sixth destination using the same frame and typography.

### Reference study, 2026-10-30

| Reference | What was examined | Adapted here |
| --- | --- | --- |
| [Fey analysis](https://mobbin.com/screens/54b4f913-aa07-40e0-9b51-3f6cc0d9b11d) | One large trend and a compact aligned market table; restrained status labels; narrow data columns | Trend becomes the first evidence object; rows share numeric alignment and small market labels. Its dark-only palette is not copied. |
| [Kraken markets](https://mobbin.com/screens/c1c85e79-bd6a-4577-a7c4-ffa4ff67dfda) | A chart directly above a dense market list, with segment controls and small status accents | Four-market strip stays one surface; the observation table uses tighter rows and clear unit/time columns. No heatmap is drawn because the current data cannot support one. |
| [Peec AI overview](https://mobbin.com/screens/bd140b6c-33cf-431f-a25e-52d58bc84a91) | Neutral fixed navigation, thin dividers, paired chart/list blocks and consistent content edges | A compact side rail anchors desktop, with aligned content and flat panels. |
| [Monarch investments](https://mobbin.com/screens/da024799-2d02-43de-9475-d5e313c2b990) | Selected time period and selected metric are visibly related to the chart | A selected primary alert is visually tied to its own archived trend, without inventing a time range control. |

The references are craft sources, not data sources. The public data contract extends only for asset identifiers, sampled asset metrics, and document metadata; no reference-specific figures, customer marks or inferred trading signals are imported.

The studied screenshots and specific takeaways are together on the [Paper reference board](https://app.paper.design/file/01M65RBRHHPCBATBN9YE47PT12/p-1-0). The original baseline is in `docs/screenshots/baseline/`; the first-pass design that prompted this second revision is in `docs/design/baseline/2026-10-30-second-pass/`. Current light and dark captures are in `docs/screenshots/`.

Second-pass tokens: ground `#f3f5f5`; sheet `#fdfefe`; ink `#17232b`; muted `#52636e`; border `#dce3e6`; data blue `#245eaf`; investigation field `#172a38`; warning `#8b5b15`; negative `#aa343b`; positive `#19704a`. The desktop rail is `210px`; sheet and bottom edge share one border. The market tape has four equal cells, while the investigation and operations grid is approximately 2:1. Body text is `14px`, labels `12–13px`, title `27px`, figures `21–26px`; phone outer margin is `16px`. IBM Plex Sans is self-hosted for interface and figures, and IBM Plex Mono is used only for code. The font files and their SIL Open Font License are in `public/fonts/`. Motion is feedback only, under `180ms`, with reduced-motion fallback.

The data accent marks actual coverage and the current time series. Status colors are limited to small text and markers. This keeps the finance display legible without confusing price direction with evidence quality. Light mode is the primary design; dark mode follows the same hierarchy.

The evidence panel joins the current comparison, its time series, and the change queue. Previous and current readings, absolute change, percentage change, unit, source, and observation time derive from the same alert object. The chart has one blue line, three y ticks and a final-point guide. On the decision page, a single record spans the available width; a list/detail split returns when there are multiple records. The judgment page has no chart, so a chart-specific `no-data-hue` warning there would be a false positive.

### Component and interaction recipe

- The desktop shell is a flat navigation rail with a simple wordmark. Phone navigation becomes a scrollable strip. Every destination keeps its existing URL hash.
- Coverage is one four-column strip, not four isolated cards. Each cell has market, explicit source state, primary measurement, unit, metric name and observed time. Failed or unconfigured cells do not reuse a stale figure.
- The asset directory is a searchable list with market filter, symbol/name, last valid quote, source/time and explicit state. A market evidence drawer links to the assets registered for that market.
- An asset detail uses the existing dark evidence field for its current quote and same-source archived trend. Its neutral rail shows identity, observation time and source state; lower sections show current metrics, alerts, research decisions and document metadata. Empty sections say what has yet to be connected.
- The alert workspace pairs the most recent comparable trend with the alert queue. A line carries an actual y-scale and observation time labels. The row and chart open the same evidence drawer; no hidden trading conclusion is implied.
- The run-health list and due-review list share the operations rail next to the investigation. Their item counts and spacing reflect the actual data.
- Tables use right-aligned tabular figures, a distinct column header and row hover. Source status stays in a separate operations pane. Empty, stale and failed states retain their own copy.
- The detail drawer uses a single metric hierarchy, measured time, formula and source URL. Focus returns to its trigger on close.
- Hover, focus and pressed feedback are short and quiet. Reduced-motion users receive the final state without animation.

No off-the-shelf React dashboard block was installed: this repository is a small dependency-free read-only app. ReUI and BoardUI components would require migrating the UI runtime, while the reference patterns can be expressed with the existing native table, button, select and dialog semantics.

## Screens and interactions

- Overview: current run/time, coverage rail, top factual alerts, four-market matrix, recent observations and run health.
- Assets: searchable directory and a page per configured asset. The page shows only valid sampled readings; stale observations never masquerade as a current quote. Alerts and imported decisions link back by stable `assetId`.
- Asset material: private `documents.jsonl` metadata covers research, filings, earnings and calls. A stable HTTPS source link is shown when supplied; OCR, PDF hosting and uploads are not part of this read-only build.
- Alerts: filter by market and severity; open an alert to read old and new values, unit, timestamps, source and formula.
- Runs: list immutable runs and source failures; open each run's observations.
- Decisions: read private imported judgments, show the original scope and counterevidence, and surface reviews due by date. The monitor never writes this file.
- Source detail: show source URL and timestamp from the run, with an explicit missing/failed state.
- Settings: documentation only in this first read-only build; configuration is edited on the host and reloaded on the next monitor run.

Top navigation changes the visible section without changing data. Filters reduce a visible list and can be cleared. A row opens a detail panel and its close control returns to the list. A theme control changes only presentation and persists locally. Every state has keyboard focus and an empty message. Mobile sections stack; tables turn into labeled rows instead of horizontal overflow.

## Data and trust rules

No default sample numbers are presented as live market facts. Empty installation shows four unconnected markets and no assets. Optional fixture data is marked as a sample everywhere. Missing values are em dashes, never zero. A failed source cannot trigger an asset or market alert from stale data. Market-wide metrics exclude asset-specific observations. The quote trend compares only the same asset, source, metric and unit. Times and source IDs remain visible with each reading. Data obtained from third parties must be used according to their terms; the repository contains only adapter code and a synthetic example.

The browser binds by default to `127.0.0.1`. Public access requires an operator-configured authentication layer such as Cloudflare Access. No browser endpoint executes scripts or edits configuration.
