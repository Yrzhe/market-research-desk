# Linux systemd example

This is an operator template, not an installed schedule. Copy it to a VPS only after setting up private configuration, credentials, and authenticated dashboard access.

Store environment values in `/etc/market-research-desk/env` with `0600` permissions. Set `DATA_DIR` to a private writable directory and `CONFIG_PATH` to an operator-owned file outside the Git checkout or to the ignored `config/local.json`.

`/etc/systemd/system/market-research-monitor.service`:

```ini
[Unit]
Description=Market Research Desk monitor run

[Service]
Type=oneshot
User=marketdesk
Group=marketdesk
WorkingDirectory=/opt/market-research-desk
EnvironmentFile=/etc/market-research-desk/env
ExecStart=/usr/bin/node /opt/market-research-desk/src/cli.js run
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/market-research-desk
PrivateTmp=true
```

`/etc/systemd/system/market-research-monitor.timer`:

```ini
[Unit]
Description=Example market monitor cadence

[Timer]
OnCalendar=*-*-* 01:10:00 UTC
Persistent=true
Unit=market-research-monitor.service

[Install]
WantedBy=timers.target
```

Use separate timers or a market-aware scheduler for each market and provider. A fixed UTC cadence is not proof that a market has closed; holidays, daylight saving time, and source publication delays need to be accounted for. Every observation carries its own `asOf` timestamp.

`/etc/systemd/system/market-research-web.service`:

```ini
[Unit]
Description=Market Research Desk read-only web service
After=network-online.target

[Service]
User=marketdesk
Group=marketdesk
WorkingDirectory=/opt/market-research-desk
EnvironmentFile=/etc/market-research-desk/env
ExecStart=/usr/bin/node /opt/market-research-desk/src/server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadOnlyPaths=/var/lib/market-research-desk
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Set `HOST=127.0.0.1`. Route an authenticated Cloudflare Tunnel to `http://127.0.0.1:4173`; do not open port 4173 to the public Internet. Test the Access policy on both `/` and `/api/state` while logged out.
