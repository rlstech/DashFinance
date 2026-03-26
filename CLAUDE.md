# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DashFinance is a Flask financial dashboard for UAU, monitoring Accounts Payable (AP), Revenues, and Cash Flow. It runs as a Docker Swarm service behind Traefik and connects to a Microsoft SQL Server.

## Running Locally

```bash
pip install -r requirements.txt
# Set env vars (see docker-compose.yml for values)
export DB_SERVER="192.168.1.8\SQLEXPRESS" DB_PORT=62311 DB_NAME=uau DB_USER=... DB_PASS=...
python app.py            # dev server on :5000
# or
gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 app:app
```

After starting, trigger a data sync: `GET /api/sync`

## Architecture

```
Browser → Flask (app.py) → cache.json (persistent)
                        ↕ on /api/sync
                    db.py → SQL Server (192.168.1.8\SQLEXPRESS, db: uau)
```

**`app.py`** — Flask routes + cache layer. On startup, loads `cache.json`; if empty, attempts a full sync (2020–2030) from DB (non-fatal if DB unreachable). All `/api/*` endpoints serve from the in-memory `_cache` dict and persist to `cache.json` on sync.

**`db.py`** — All DB access via `pymssql`. Three functions:
- `get_ap(de, ate)` — queries `VwDesembolsoAPagar` + `Pessoas` + `CategoriasDeMovFin`
- `get_receitas(de, ate)` — combines `ContasReceber`, `VWBI_Receitas`, `Recebidas`
- `get_saldo_banco(de, ate)` — queries `SaldoConta`

**`templates/`** — Three Jinja2 dashboards (`dashboard_ap.html`, `dashboard_receitas.html`, `dashboard_fluxo.html`), all built with Chart.js 4.4.0 + Lucide icons + vanilla JS. Each fetches its data from `/api/*` on load.

## API Endpoints

| Route | Description |
|---|---|
| `GET /api/sync` | Re-query DB, update and persist cache |
| `GET /api/status` | Cache metadata (last sync time, date range) |
| `GET /api/ap` | Cached AP records |
| `GET /api/receitas` | Cached revenue records |
| `GET /api/saldo_banco` | Cached bank balances |

## Data Schemas

**AP record** (`/api/ap`):
```js
{ empresa, obra, data, fornecedor, banco, conta, categoria, valor, origem }
// origem: "Planejamento" | "Emissao"
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
- No test suite, no linter.

## Deployment

CI/CD: push to `master` → GitHub Actions builds and pushes `ghcr.io/rlstech/dashfinance:latest` → triggers Portainer webhook to redeploy the Swarm stack.

The app is publicly accessible at `https://dash.railton.eu.org` via Traefik (TLS via Let's Encrypt). Cache is stored in a persistent Docker volume mounted at `/app`.

## Legacy Scripts

The root-level `export_data.py`, `inject_data.py`, `export_receitas.py`, `inject_receitas.py`, `query_ap.py`, `format_ap.py`, etc. are pre-Flask tools that write data to `data_ap.json` / `data_receitas.json` and embed it into `dashboard.html` / `dashboard_receitas.html`. These are still usable for CLI/batch operations but **Flask is the primary interface**. The root-level `dashboard.html` and `dashboard_receitas.html` are the legacy standalone files.
