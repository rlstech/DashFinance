# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DashFinance is a self-contained financial dashboard for "Contas a Pagar" (Accounts Payable) monitoring at UAU. It consists of a single-file HTML dashboard fed by Python data extraction scripts connected to a Microsoft SQL Server.

## Data Pipeline

```
SQL Server (192.168.1.8\SQLEXPRESS, db: uau)
    → export_data.py      → data_ap.json
    → inject_data.py      → dashboard.html (data embedded)
    → open dashboard.html in browser
```

To refresh dashboard data:
```bash
python export_data.py    # pulls from SQL Server → data_ap.json
python inject_data.py    # embeds data_ap.json into dashboard.html
```

Console utilities (no browser needed):
```bash
python query_ap.py       # raw JSON output
python query_ap_v2.py    # summary by empresa/obra
python format_ap.py      # formatted table
python format_ap_v2.py   # enhanced table with totals
```

## Architecture

**Frontend** (`dashboard.html`) — single file, no build step, no dependencies except Chart.js 4.4.0 (CDN):
- Sidebar navigation + top bar with date range filters (De/Até)
- 4 KPI cards: Total a Pagar, Emissão, Planejamento, Obras Ativas
- Chart.js charts: daily timeline (line) and company distribution (donut)
- Searchable/filterable/paginated data table (20 rows/page), CSV export
- Side panel: top 8 suppliers, AI-generated insights block
- All state and rendering is in vanilla JS; data lives in the `ALL_DATA` global variable injected by `inject_data.py`

**Data schema** (each record in `ALL_DATA`):
```js
{ empresa, obra, data, fornecedor, banco, conta, categoria, valor, origem }
// origem is either "Planejamento" or "Emissao"
// data format: DD/MM/YYYY
// valor: number (BRL)
```

**Python scripts** use `pymssql` to query views/tables: `VwDesembolsoAPagar`, `ContasPagas`, `Pessoas`, `CategoriasDeMovFin`, `Prorroga`. The date range queried is set directly in the SQL within `export_data.py`.

## Key Conventions

- Currency is Brazilian Real (BRL); use `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` for formatting.
- Empresa IDs are strings: `"1"`, `"3"`, `"4"`, `"5"`.
- When modifying date filtering logic in the dashboard, dates in `ALL_DATA` are in `DD/MM/YYYY` format and must be parsed accordingly (day/month/year, not month/day/year).
- `inject_data.py` replaces the `ALL_DATA = [...]` block in `dashboard.html` — keep that marker intact when editing the HTML.
- There is no test suite and no linter configured.
