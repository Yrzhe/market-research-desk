# Market Research Desk — Design MD

## Brief and scope

An open-source read-only research desk for four markets. A private deployment runs configurable monitors, retains dated factual evidence, and surfaces factual alerts for a human research decision. Public source contains no personal holdings, research archive, recipients, credentials, or live market data.

Surface: app screen. The overview answers: **What changed since the last valid observation, and what needs investigation?** With no configured source, its honest finding is that no market has been connected. The primary job is to inspect an alert and its evidence; secondary jobs are checking source health and prior runs.

## Inventory

- Markets: A shares, Hong Kong, US, and crypto, each with its own observation timestamp and time zone.
- A monitor reports numeric observations with unit, source URL, as-of time and capture time.
- A rule compares a current observation with the preceding compatible one and emits a factual alert.
- An alert has a stable ID, severity, status, calculation, and a link to its immutable run.
- A run has an ID, trigger, start and end time, per-source outcomes, and data quality.
- Decisions are research artifacts added by a separate private process; the monitor does not infer buy or sell actions.
- A new installation typically has zero observations, zero alerts and four unconnected markets.
- The daily reader uses desktop for comparison and a phone for alerts and status.
- The product's own object is an evidence trail: observation → comparison → alert → research decision.

## Direction and reference lock

Taste-skill `achromatic-ledger`, seed `1152222347`, drawn 2026-10-30, finance app screen. The first implementation was too sparse: large all-purpose cards made coverage, alerts, evidence and run health feel equally important; the top navigation and blue-grey canvas read like a generic admin template. The revision keeps the product's neutral daylight palette, Geist, factual scope and five destinations, but makes the four-market strip, change chart and investigation queue a coherent work surface. No decorative imagery.

### Reference study, 2026-10-30

| Reference | What was examined | Adapted here |
| --- | --- | --- |
| [Fey analysis](https://mobbin.com/screens/54b4f913-aa07-40e0-9b51-3f6cc0d9b11d) | One large trend and a compact aligned market table; restrained status labels; narrow data columns | Trend becomes the first evidence object; rows share numeric alignment and small market labels. Its dark-only palette is not copied. |
| [Kraken markets](https://mobbin.com/screens/c1c85e79-bd6a-4577-a7c4-ffa4ff67dfda) | A chart directly above a dense market list, with segment controls and small status accents | Four-market strip stays one surface; the observation table uses tighter rows and clear unit/time columns. No heatmap is drawn because the current data cannot support one. |
| [Peec AI overview](https://mobbin.com/screens/bd140b6c-33cf-431f-a25e-52d58bc84a91) | Neutral fixed navigation, thin dividers, paired chart/list blocks and consistent content edges | A compact side rail anchors desktop, with aligned content and flat panels. |
| [Monarch investments](https://mobbin.com/screens/da024799-2d02-43de-9475-d5e313c2b990) | Selected time period and selected metric are visibly related to the chart | A selected primary alert is visually tied to its own archived trend, without inventing a time range control. |

The references are craft sources, not data sources. The code keeps the product's existing public data contract, so no reference-specific figures, market labels, customer marks or inferred trading signals are imported.

The three studied screenshots and the specific takeaways are together on the [Paper reference board](https://app.paper.design/file/01M65RBRHHPCBATBN9YE47PT12/p-1-0). The earlier desktop and phone screenshots are retained in `docs/screenshots/baseline/`; the current captures replace the preview images in `docs/screenshots/`.

Tokens: ground `#f7f8fa`; surface `#ffffff`; text `#151c24`; muted `#607080`; quiet text `#5c6976`; border `#e2e7ec`; data blue `#245eaf`; warning `#8b5b15`; negative `#aa343b`; positive `#19704a`; card radius `10px`; control radius `7px`; row `56px`; body `14px`; label `12px`; title `30px`; tabular figures `24px`. Fonts: Geist for interface, Geist Mono only for IDs and keys; system fallbacks. Desktop rail `216px`, content width up to `1320px`, phone margin `16px`. Motion is feedback only, under `180ms`, with reduced-motion fallback.

The data accent marks actual coverage and the current time series. Status colors are limited to small text and markers. This keeps the finance display legible without confusing price direction with evidence quality. Light mode is the primary design; dark mode follows the same hierarchy.

The visual inspector reports `no-data-hue` on the judgment page even though that page contains no chart. The judgment's due count uses the blue data accent; a fabricated chart would make the evidence less clear.

### Component and interaction recipe

- The desktop shell is a flat navigation rail with a simple wordmark. Phone navigation becomes a scrollable strip. Every destination keeps its existing URL hash.
- Coverage is one four-column strip, not four isolated cards. Each cell has market, explicit source state, primary measurement, unit, metric name and observed time. Failed or unconfigured cells do not reuse a stale figure.
- The alert workspace pairs the most recent comparable trend with the alert queue. A line carries an actual y-scale and observation time labels. The row and chart open the same evidence drawer; no hidden trading conclusion is implied.
- The run-health list and due-review list share a right column. They can be shorter than the chart because their height reflects the actual count; blank filler would make operational data look more substantial than it is.
- Tables use right-aligned tabular figures, a distinct column header and row hover. Source status stays in a separate operations pane. Empty, stale and failed states retain their own copy.
- The detail drawer uses a single metric hierarchy, measured time, formula and source URL. Focus returns to its trigger on close.
- Hover, focus and pressed feedback are short and quiet. Reduced-motion users receive the final state without animation.

No off-the-shelf React dashboard block was installed: this repository is a small dependency-free read-only app. ReUI and BoardUI components would require migrating the UI runtime, while the reference patterns can be expressed with the existing native table, button, select and dialog semantics.

## Screens and interactions

- Overview: current run/time, coverage rail, top factual alerts, four-market matrix, recent observations and run health.
- Alerts: filter by market and severity; open an alert to read old and new values, unit, timestamps, source and formula.
- Runs: list immutable runs and source failures; open each run's observations.
- Decisions: read private imported judgments, show the original scope and counterevidence, and surface reviews due by date. The monitor never writes this file.
- Source detail: show source URL and timestamp from the run, with an explicit missing/failed state.
- Settings: documentation only in this first read-only build; configuration is edited on the host and reloaded on the next monitor run.

Top navigation changes the visible section without changing data. Filters reduce a visible list and can be cleared. A row opens a detail panel and its close control returns to the list. A theme control changes only presentation and persists locally. Every state has keyboard focus and an empty message. Mobile sections stack; tables turn into labeled rows instead of horizontal overflow.

## Data and trust rules

No default sample numbers are presented as live market facts. Empty installation shows four unconnected markets. Optional fixture data is marked as a sample everywhere. Missing values are em dashes, never zero. A failed source cannot trigger a market alert from stale data. Market times are displayed per source. Data obtained from third parties must be used according to their terms; the repository contains only adapter code and a synthetic example.

The browser binds by default to `127.0.0.1`. Public access requires an operator-configured authentication layer such as Cloudflare Access. No browser endpoint executes scripts or edits configuration.
