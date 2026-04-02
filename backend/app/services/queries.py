"""
Queries SQL migradas de db.py — preservadas exatamente.
Todas usam placeholders parametrizados (%s).
"""
import pymssql
from app.services.database import get_db

EMPRESA_MAP = {1: "COMBRASEN", 3: "DRESDEN", 4: "TRUST", 5: "GAMA 01", 6: "CONSÓRCIO HMSJ"}

_SALDO_CONTA_COL: str | None = None


def _get_saldo_conta_col() -> str | None:
    """Descobre o nome da coluna de conta corrente na SaldoConta."""
    with get_db() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(
            """
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'SaldoConta' AND COLUMN_NAME LIKE %s
            """,
            ("%onta%",),
        )
        cols = [r["COLUMN_NAME"] for r in cur.fetchall()]
    for c in cols:
        if c.lower().startswith("conta") and "banco" not in c.lower():
            return c
    return None


def get_ap(de: str = "2026-01-01", ate: str = "2026-06-30") -> list[dict]:
    sql = """
    SELECT Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria,
           SUM(Valor) AS Valor, Origem
    FROM (
        SELECT
            CASE v.Empresa_des
                WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
                WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
                WHEN 6 THEN 'CONSÓRCIO HMSJ'
                ELSE CAST(v.Empresa_des AS VARCHAR)
            END AS Empresa,
            CAST(v.Obra_des AS VARCHAR) AS Obra,
            CONVERT(VARCHAR(10), v.DtPgto_des, 103) AS Data,
            p.nome_pes AS Fornecedor,
            CAST(v.Banco_des AS VARCHAR) AS Banco,
            v.ContaCorr_des AS Conta,
            ISNULL(cmf.Desc_cmf, 'S/Categoria') AS Categoria,
            v.TotalLiq_des AS Valor,
            CASE WHEN v.StatusParc_des = 0 THEN 'A Confirmar' ELSE 'Emissao' END AS Origem
        FROM VwDesembolsoAPagar v
        LEFT JOIN Pessoas p ON p.cod_pes = v.CodForn_Des
        LEFT JOIN CategoriasDeMovFin cmf ON cmf.Codigo_cmf = v.CategMovFin_Des
        WHERE v.StatusParc_des IN (0, 1)
          AND v.DtPgto_des BETWEEN %s AND %s

        UNION ALL

        SELECT
            CASE v.Empresa_des
                WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
                WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
                WHEN 6 THEN 'CONSÓRCIO HMSJ'
                ELSE CAST(v.Empresa_des AS VARCHAR)
            END AS Empresa,
            CAST(v.Obra_des AS VARCHAR) AS Obra,
            CONVERT(VARCHAR(10), v.DtPgto_des, 103) AS Data,
            p.nome_pes AS Fornecedor,
            CAST(v.Banco_des AS VARCHAR) AS Banco,
            v.ContaCorr_des AS Conta,
            ISNULL(cmf.Desc_cmf, 'S/Categoria') AS Categoria,
            v.TotalLiq_des AS Valor,
            'Pago' AS Origem
        FROM VwDesembolsoPago v
        LEFT JOIN Pessoas p ON p.cod_pes = v.CodForn_Des
        LEFT JOIN CategoriasDeMovFin cmf ON cmf.Codigo_cmf = v.CategMovFin_Des
        WHERE v.DtPgto_des BETWEEN %s AND %s
    ) t
    GROUP BY Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, Origem
    ORDER BY Data, Empresa, Obra
    """
    with get_db() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(sql, (de, ate, de, ate))
        rows = cur.fetchall()
    return [
        {
            "empresa": r["Empresa"] or "",
            "obra": r["Obra"] or "",
            "data": r["Data"] or "",
            "fornecedor": (r["Fornecedor"] or "").strip(),
            "banco": str(r["Banco"] or "").strip(),
            "conta": str(r["Conta"] or "").strip(),
            "categoria": r["Categoria"] or "",
            "valor": float(r["Valor"] or 0),
            "origem": r["Origem"] or "",
        }
        for r in rows
    ]


def get_receitas(de: str = "2026-01-01", ate: str = "2026-06-30") -> list[dict]:
    sql = """
    SELECT Empresa, Obra, Cliente, Tipo, Data, DataVenc, Valor, Status, Banco, Conta
    FROM (
        SELECT
            CASE cr.Empresa_prc
                WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
                WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
                WHEN 6 THEN 'CONSÓRCIO HMSJ'
                ELSE CAST(cr.Empresa_prc AS VARCHAR)
            END AS Empresa,
            CAST(cr.Obra_Prc AS VARCHAR) AS Obra,
            ISNULL(p.nome_pes, '') AS Cliente,
            cr.Tipo_Prc AS Tipo,
            CONVERT(VARCHAR(10), ISNULL(cr.DataPror_Prc, cr.Data_Prc), 103) AS Data,
            CONVERT(VARCHAR(10), ISNULL(cr.DataPror_Prc, cr.Data_Prc), 103) AS DataVenc,
            cr.Valor_Prc AS Valor,
            'A Receber' AS Status,
            ISNULL(CAST(cr.NumeroBanco_prc AS VARCHAR), '') AS Banco,
            ISNULL(cr.ContaBanco_prc, '') AS Conta
        FROM ContasReceber cr
        LEFT JOIN Pessoas p ON p.cod_pes = cr.Cliente_Prc
        WHERE cr.Status_Prc = 0
          AND ISNULL(cr.DataPror_Prc, cr.Data_Prc) BETWEEN %s AND %s

        UNION ALL

        SELECT
            CASE v.Empresa
                WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
                WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
                WHEN 6 THEN 'CONSÓRCIO HMSJ'
                ELSE CAST(v.Empresa AS VARCHAR)
            END AS Empresa,
            CAST(v.Obra AS VARCHAR) AS Obra,
            ISNULL(v.[Nome cliente], '') AS Cliente,
            v.[Tipo parcela] AS Tipo,
            CONVERT(VARCHAR(10), v.Data, 103) AS Data,
            CONVERT(VARCHAR(10), v.Data, 103) AS DataVenc,
            v.[Valor recebido] AS Valor,
            'Recebida' AS Status,
            ISNULL(CAST(rp.BancoDep_Rpg AS VARCHAR), '') AS Banco,
            ISNULL(rp.ContaDep_Rpg, '') AS Conta
        FROM VWBI_Receitas v
        LEFT JOIN Recebidas rec
            ON  rec.Empresa_rec = v.Empresa
            AND rec.NumVend_Rec  = v.[Numero Venda]
            AND rec.Obra_Rec     = v.Obra
            AND rec.NumParc_Rec  = v.[Numero parcela]
            AND CAST(rec.Data_Rec AS DATE) = CAST(v.Data AS DATE)
            AND rec.Status_Rec   = 1
        LEFT JOIN RecebePgto rp
            ON  rp.Empresa_rpg  = rec.Empresa_rec
            AND rp.NumReceb_Rpg = rec.NumReceb_Rec
        WHERE v.StatusPL = 'REALIZADO'
          AND v.[Valor recebido] > 0
          AND v.Data BETWEEN %s AND %s

        UNION ALL

        SELECT
            CASE r.Empresa_rec
                WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
                WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
                WHEN 6 THEN 'CONSÓRCIO HMSJ'
                ELSE CAST(r.Empresa_rec AS VARCHAR)
            END AS Empresa,
            CAST(r.Obra_Rec AS VARCHAR) AS Obra,
            ISNULL(p.nome_pes, '') AS Cliente,
            r.Tipo_Rec AS Tipo,
            CONVERT(VARCHAR(10), r.Data_Rec, 103) AS Data,
            CONVERT(VARCHAR(10), r.DataVenci_Rec, 103) AS DataVenc,
            r.ValorConf_Rec AS Valor,
            'Recebida' AS Status,
            ISNULL(CAST(rp.BancoDep_Rpg AS VARCHAR), '') AS Banco,
            ISNULL(rp.ContaDep_Rpg, '') AS Conta
        FROM Recebidas r
        LEFT JOIN Pessoas p ON p.cod_pes = r.Cliente_Rec
        LEFT JOIN RecebePgto rp
            ON  rp.Empresa_rpg  = r.Empresa_rec
            AND rp.NumReceb_Rpg = r.NumReceb_Rec
        WHERE r.Status_Rec = 1
          AND r.Data_Rec BETWEEN %s AND %s
          AND r.Empresa_rec NOT IN (SELECT DISTINCT Empresa FROM VWBI_Receitas)
    ) t
    ORDER BY Data, Empresa, Obra
    """
    with get_db() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(sql, (de, ate, de, ate, de, ate))
        rows = cur.fetchall()
    return [
        {
            "empresa": r["Empresa"] or "",
            "obra": r["Obra"] or "",
            "cliente": (r["Cliente"] or "").strip(),
            "tipo": r["Tipo"] or "",
            "data": r["Data"] or "",
            "data_venc": r["DataVenc"] or "",
            "valor": float(r["Valor"] or 0),
            "status": r["Status"] or "",
            "banco": str(r["Banco"] or "").strip(),
            "conta": str(r["Conta"] or "").strip(),
        }
        for r in rows
    ]


def get_saldo_banco(de: str = "2020-01-01", ate: str = "2030-12-31") -> list[dict]:
    global _SALDO_CONTA_COL
    if _SALDO_CONTA_COL is None:
        _SALDO_CONTA_COL = _get_saldo_conta_col() or ""

    conta_select = f"ISNULL({_SALDO_CONTA_COL}, '')" if _SALDO_CONTA_COL else "''"
    sql = f"""
    SELECT
        CASE Empresa_sdcc
            WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
            WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
            WHEN 6 THEN 'CONSÓRCIO HMSJ'
        END AS Empresa,
        CAST(Banco_sdcc AS VARCHAR) AS Banco,
        {conta_select} AS Conta,
        CONVERT(varchar, Data_sdcc, 103) AS Data,
        Saldo_sdcc AS Saldo
    FROM SaldoConta
    WHERE Data_sdcc BETWEEN %s AND %s
      AND Empresa_sdcc IN (1, 3, 4, 5, 6)
    ORDER BY Data_sdcc, Empresa_sdcc, Banco_sdcc
    """
    with get_db() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(sql, (de, ate))
        rows = cur.fetchall()
    return [
        {
            "empresa": r["Empresa"] or "",
            "banco": str(r["Banco"] or "").strip(),
            "conta": str(r["Conta"] or "").strip(),
            "data": r["Data"] or "",
            "saldo": float(r["Saldo"] or 0),
        }
        for r in rows
    ]
