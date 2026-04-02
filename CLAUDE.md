# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DashFinance is a financial dashboard for UAU, monitoring Accounts Payable (AP), Revenues, and Cash Flow. It runs as a Docker Swarm stack (3 services: backend, frontend, redis) behind Traefik and connects to a Microsoft SQL Server.

## Architecture

```
Browser → Nginx (frontend React SPA) → /api/* → FastAPI (backend) → Redis cache
                                                                   ↕ on /api/sync
                                                               queries.py → SQL Server
```

**`backend/`** — FastAPI app (Python 3.12):
- `app/main.py` — FastAPI app with CORS, lifespan (APScheduler + initial sync)
- `app/config.py` — Pydantic BaseSettings (all env vars)
- `app/api/` — routers: `financeiro.py` (data endpoints), `sync.py` (sync/status), `filters.py` (filter tree)
- `app/services/database.py` — pymssql connection pool
- `app/services/cache.py` — async Redis client
- `app/services/queries.py` — **exact SQL queries** (get_ap, get_receitas, get_saldo_banco)
- `app/services/sync.py` — sync_all() + APScheduler
- `app/models/schemas.py` — Pydantic models

**`frontend/`** — React 18 + Vite 5 + TypeScript SPA:
- `src/App.tsx` — React Router v6 with QueryClientProvider
- `src/pages/` — ContasAPagar, Receitas, FluxoCaixa, Configuracoes
- `src/hooks/` — useFilters (Zustand), useFinanceiro (TanStack Query)
- `src/components/` — layout (Sidebar, Header), filters (FilterBar, MultiSelect), charts (Timeline, Donut, CashFlow), tables (DataTable)
- `src/types/index.ts` — TypeScript interfaces + EMPRESA_COLORS/ABBR constants

**`cf_proxy/`** — TCP proxy tunneling SQL Server via Cloudflare Access (used when FortiGate VPN is unavailable).

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
export DB_HOST=192.168.1.8 DB_PORT=62311 DB_NAME=uau DB_USER=... DB_PASSWORD=...
export REDIS_URL=redis://localhost:6379/0
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # dev server on :5173, proxies /api → localhost:8000
```

## Environment Variables (backend)

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | ✅ | SQL Server host |
| `DB_PORT` | ❌ (default: 62311) | SQL Server port |
| `DB_NAME` | ✅ | Database name |
| `DB_USER` | ✅ | Database username |
| `DB_PASSWORD` | ✅ | Database password |
| `REDIS_URL` | ❌ (default: redis://localhost:6379/0) | Redis connection URL |
| `CORS_ORIGINS` | ❌ | JSON array of allowed origins |
| `SYNC_INTERVAL_MINUTES` | ❌ (default: 60) | Auto-sync interval (0 = disabled) |
| `SYNC_DATE_FROM` | ❌ (default: 2020-01-01) | Data range start |
| `SYNC_DATE_TO` | ❌ (default: 2030-12-31) | Data range end |
| `TZ` | ❌ | Timezone (default: America/Sao_Paulo) |

> **Important**: Configure `DB_USER`, `DB_PASSWORD` as environment variables in Portainer, NOT in `docker-compose.yml`.

## API Endpoints

| Route | Description |
|---|---|
| `GET /api/sync` | Re-query DB, update Redis cache |
| `GET /api/status` | Cache metadata (last sync, counts) |
| `GET /api/ap` | AP records |
| `GET /api/receitas` | Revenue records |
| `GET /api/saldo_banco` | Bank balance records |
| `GET /api/filters/tree` | Pre-computed filter tree (empresas, obras, bancos, contas) |

## Data Schemas

**AP record**: `{ empresa, obra, data, fornecedor, banco, conta, categoria, valor, origem }`
- `origem`: `"A Confirmar" | "Emissao" | "Pago"`

**Receitas record**: `{ empresa, obra, cliente, tipo, data, data_venc, valor, status, banco, conta }`
- `status`: `"Recebida" | "A Receber"`

**Saldo record**: `{ empresa, banco, conta, data, saldo }`

## Key Conventions

- Currency is BRL; `formatCurrency()` in `frontend/src/lib/formatters.ts`.
- Dates in API responses are `DD/MM/YYYY` — use `parseDate()` in formatters.ts to parse.
- Company canonical mapping: `{1: 'COMBRASEN', 3: 'DRESDEN', 4: 'TRUST', 5: 'GAMA 01', 6: 'CONSÓRCIO HMSJ'}`.
- SQL queries use parameterized placeholders (`%s`), never f-strings.
- **Banco filter semantics**: Fluxo de Caixa uses permissive filter (empty banco on receitas passes through); Receitas page uses strict filter.
- No test suite, no linter.

## Deployment

CI/CD: push to `master` → GitHub Actions builds and pushes two images:
- `ghcr.io/rlstech/dashfinance-backend:latest`
- `ghcr.io/rlstech/dashfinance-frontend:latest`

Then SSH-deploys both services via `docker service update`.

The app is publicly accessible at `https://dash.railton.eu.org` via Traefik (TLS via Let's Encrypt).

## Legacy Scripts

`_legacy/` contains pre-Flask tools (`export_data.py`, `inject_data.py`, `query_ap.py`, etc.) kept for reference only.
