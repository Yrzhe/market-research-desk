# Coverage matrix

This matrix describes the repository's first release. “Local pass” means it was checked against the local server; it does not imply a hosted deployment or live market data.

| Surface or flow | Empty data | Synthetic sample | Phone 390px | Desktop 1440px | Dark theme | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Overview and four-market coverage | Pass | Pass | Pass | Pass | Pass | Local pass |
| Alert list, market filter, evidence panel | Pass | Pass | Pass | Pass | Pass | Local pass |
| Run list and run evidence | Pass | Pass | Pass | Pass | Pass | Local pass |
| Decision ledger and due review | Pass | Pass | Pass | Pass | Pass | Local pass |
| Configuration guidance | Pass | Pass | Pass | Pass | Pass | Local pass |
| HTTP JSON and local script monitors | Unconfigured state | Local script test | N/A | N/A | N/A | Local pass |
| Telegram notification | Unset state | N/A | N/A | N/A | N/A | Code only; no live bot credentials used |
| Webhook notification | Unset state | Local test receiver | N/A | N/A | N/A | Local pass |
| Cloudflare Access and Tunnel | N/A | N/A | N/A | N/A | N/A | Deployment template only; no hosted acceptance |

All visible buttons navigate, reload, filter, open or close a detail, or switch theme. The web API exposes only `GET /api/state` and static assets. Other paths return 404; write methods return 405. The monitor is a CLI and cannot be invoked from the browser.

The synthetic sample is labelled in the interface and stored separately from live archives. A fresh deployment has no data. Market source failures, missing fields and stale observations are explicit states. Current values are shown only for valid observations in the latest run.
