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

Taste-skill `achromatic-ledger`, seed `1152222347`, drawn 2026-10-30, finance app screen. Chosen because this is a daytime decision desk with dense figures. Preserve neutral chrome, aligned tabular numbers, flat surfaces, compact title, and one blue data accent. Face: blue-grey ledger ground `#f2f4f7`. Signature element: a four-market coverage rail whose segmented state shows which markets actually produced valid observations. No decorative imagery.

Tokens: ground `#f2f4f7`; surface `#fff`; text `#0a0a0a`; muted `#626b76`; border `#e0e4e8`; data blue `#1d5fbf`; warning `#92400e`; negative `#a92830`; card radius `8px`; control radius `6px`; row `44px`; body `14px`; label `12px`; title `24px`; tabular figures `30px`. Fonts: Geist for interface, Geist Mono only for IDs and keys; system fallbacks. Desktop column `1208px`, phone margin `16px`. Motion is feedback only, under `180ms`, with reduced-motion fallback.

The data accent marks actual coverage and the current time series. Status colors are limited to small text and markers. This keeps the finance display legible without confusing price direction with evidence quality. Light mode is the primary design; dark mode follows the same hierarchy.

## Screens and interactions

- Overview: current run/time, coverage rail, top factual alerts, four-market matrix, recent observations and run health.
- Alerts: filter by market and severity; open an alert to read old and new values, unit, timestamps, source and formula.
- Runs: list immutable runs and source failures; open each run's observations.
- Source detail: show source URL and timestamp from the run, with an explicit missing/failed state.
- Settings: documentation only in this first read-only build; configuration is edited on the host and reloaded on the next monitor run.

Top navigation changes the visible section without changing data. Filters reduce a visible list and can be cleared. A row opens a detail panel and its close control returns to the list. A theme control changes only presentation and persists locally. Every state has keyboard focus and an empty message. Mobile sections stack; tables turn into labeled rows instead of horizontal overflow.

## Data and trust rules

No default sample numbers are presented as live market facts. Empty installation shows four unconnected markets. Optional fixture data is marked as a sample everywhere. Missing values are em dashes, never zero. A failed source cannot trigger a market alert from stale data. Market times are displayed per source. Data obtained from third parties must be used according to their terms; the repository contains only adapter code and a synthetic example.

The browser binds by default to `127.0.0.1`. Public access requires an operator-configured authentication layer such as Cloudflare Access. No browser endpoint executes scripts or edits configuration.
