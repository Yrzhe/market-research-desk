# Contributor and agent rules

- This is a public repository. Never commit `.env`, real API URLs with credential parameters, personal holdings, research reports, source payloads, run archives, Telegram recipients, private hostnames, or access tokens.
- Add generic adapters and configuration examples. Keep every credential in operator-provided environment variables.
- The monitor reports dated facts and threshold alerts only. It must not generate buy/sell conclusions or place trades.
- Every value in the dashboard needs a unit, source ID, observation time, and a truthful missing or stale state.
- Keep the web API read-only. Never expose script execution or config edits through a browser endpoint.
- Verify both light and dark themes at desktop and phone widths after UI changes. Screenshots with `?sample=1` show fictional data and must retain that label.
