# Local verification

- `npm run check`: unit and integration checks for comparable alerts, missing and stale observations, immutable runs, local script collection, and webhook credential separation.
- `node --check public/app.js` and `node --check src/server.js`: syntax pass.
- `frontend-design` UI audit at 390px and 1440px: no horizontal overflow, contrast failures, emoji, unnamed controls, missing landmarks, or console errors. A strict Content Security Policy prevents the audit script from injecting an inline style for its keyboard probe; keyboard navigation and detail escape were checked separately in Chrome.
- `taste-skill inspect --app`: overview in empty and synthetic states returned 0 FAIL and 0 WARN at 1440px, 768px and 390px. The judgment screen returned 0 FAIL and one `no-data-hue` warning; it has no chart, and its due count uses the data accent. Screenshots were inspected for both data states.
- Chrome walkthrough: overview, alert evidence, market trend, market filter, run evidence, judgment detail and linked run, theme switch, and phone refresh control all worked. The phone layout had no horizontal overflow.

Hosted authentication, live source coverage, Telegram delivery, VPS timers, and Cloudflare routing were not tested in this local repository build. The synthetic sample is fictional and explicitly labelled.
