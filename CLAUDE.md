# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DashFinance is a Flask financial dashboard for UAU, monitoring Accounts Payable (AP), Revenues, and Cash Flow. It runs as a Docker Swarm service behind Traefik and connects to a Microsoft SQL Server.

## Running Locally

```bash
pip install -r requirements.txt
# Set REQUIRED env vars (no hardcoded defaults — app will crash without them)
export DB_SERVER=192.168.1.8 DB_PORT=62311 DB_NAME=uau DB_USER=... DB_PASS=...
# Optional: authentication (if not set, dashboard is open)
export DASH_USER=admin DASH_PASS=my_password
# Optional: automatic sync interval in minutes (default: 60, 0 to disable)
export SYNC_INTERVAL_MIN=60
python app.py            # dev server on :5000
# or
gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 4 --timeout 120 app:app
```

After starting, trigger a data sync: `GET /api/sync`

## Architecture

```
Browser → Flask (app.py) → cache.json (persistent)
                        ↕ on /api/sync + periodic auto-sync
                    db.py → SQL Server (via parameterized queries)
```

**`app.py`** — Flask routes + cache layer + HTTP Basic Auth. On startup, loads `cache.json`; if empty, attempts a full sync from DB (non-fatal if DB unreachable). All `/api/*` endpoints serve from the in-memory `_cache` dict and persist to `cache.json` on sync. A background timer auto-syncs every `SYNC_INTERVAL_MIN` minutes. The sync date range is hardcoded to `2020-01-01` → `2030-12-31` in `_do_sync()`.

**`cf_proxy/`** — Alternative connectivity option: a Python asyncio TCP proxy (`proxy.py`) that tunnels SQL Server connections through Cloudflare Access using service tokens (WebSocket). Used on the VPS when FortiGate VPN is not available. Configured via `CF_HOSTNAME`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, and `LISTEN_PORT` env vars.

**`db.py`** — All DB access via `pymssql` with **parameterized queries** (no f-strings). Three functions:
- `get_ap(de, ate)` — queries `VwDesembolsoAPagar` + `Pessoas` + `CategoriasDeMovFin`
- `get_receitas(de, ate)` — combines `ContasReceber`, `VWBI_Receitas`, `Recebidas`
- `get_saldo_banco(de, ate)` — queries `SaldoConta`

**`templates/`** — Three Jinja2 dashboards (`dashboard_ap.html`, `dashboard_receitas.html`, `dashboard_fluxo.html`), all built with Chart.js 4.4.0 + Lucide icons + vanilla JS. Each fetches its data from `/api/*` on load.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_SERVER` | ✅ | SQL Server host |
| `DB_PORT` | ❌ (default: 62311) | SQL Server port |
| `DB_NAME` | ✅ | Database name |
| `DB_USER` | ✅ | Database username |
| `DB_PASS` | ✅ | Database password |
| `DASH_USER` | ❌ | HTTP Basic Auth username (empty = no auth) |
| `DASH_PASS` | ❌ | HTTP Basic Auth password |
| `SYNC_INTERVAL_MIN` | ❌ (default: 60) | Auto-sync interval in minutes (0 = disabled) |
| `CACHE_FILE` | ❌ | Path to cache.json |
| `PORT` | ❌ (default: 5000) | Flask port (dev server only) |
| `TZ` | ❌ | Timezone (default: America/Sao_Paulo) |

> ⚠️ **Security**: DB credentials and auth credentials MUST be provided via environment variables or Docker secrets. Never hardcode credentials in source code.

## API Endpoints

| Route | Description |
|---|---|
| `GET /api/sync` | Re-query DB, update and persist cache |
| `GET /api/status` | Cache metadata (last sync time, date range, counts) |
| `GET /api/ap` | Cached AP records |
| `GET /api/receitas` | Cached revenue records |
| `GET /api/saldo_banco` | Cached bank balances |

All endpoints require HTTP Basic Auth when `DASH_USER` is configured.

## Data Schemas

**AP record** (`/api/ap`):
```js
{ empresa, obra, data, fornecedor, banco, conta, categoria, valor, origem }
// origem: "A Confirmar" | "Emissao"
```

**Receitas record** (`/api/receitas`):
```js
{ empresa, obra, cliente, tipo, data, data_venc, valor, status }
// data_venc: sempre usa data de prorrogação (DataPror_Prc / DataPror_Rec), nunca o vencimento original
```

**Saldo record** (`/api/saldo_banco`):
```js
{ empresa, data, saldo }
```

## Key Conventions

- Currency is BRL; use `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Dates in all API responses are `DD/MM/YYYY` — parse as day/month/year in JS.
- Company IDs are integers in `db.py` but may appear as strings in legacy code. Canonical mapping: `{1: 'COMBRASEN', 3: 'DRESDEN', 4: 'TRUST', 5: 'GAMA 01', 6: 'CONSÓRCIO HMSJ'}`.
- SQL queries use parameterized placeholders (`%s`), never f-strings.
- Single Gunicorn worker with threads to keep cache consistent in-memory.
- No test suite, no linter.

## Deployment

CI/CD: push to `master` → GitHub Actions builds and pushes `ghcr.io/rlstech/dashfinance:latest` → triggers Portainer webhook to redeploy the Swarm stack.

The app is publicly accessible at `https://dash.railton.eu.org` via Traefik (TLS via Let's Encrypt). Cache is stored in a persistent Docker volume mounted at `/cache`.

> **Important**: Configure `DB_USER`, `DB_PASS`, `DASH_USER`, and `DASH_PASS` as environment variables in Portainer, NOT in `docker-compose.yml`.

## Legacy Scripts

Legacy pre-Flask tools have been moved to `_legacy/`. These include `export_data.py`, `inject_data.py`, `query_ap.py`, `format_ap.py`, etc. They are kept for reference but are **not used by Flask**.
