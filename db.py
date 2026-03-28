import pymssql
import os

DB = dict(
    server=os.environ['DB_SERVER'],
    port=int(os.environ.get('DB_PORT', '62311')),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASS'],
)

EMPRESA_MAP = {1:'COMBRASEN', 3:'DRESDEN', 4:'TRUST', 5:'GAMA 01', 6:'CONSÓRCIO HMSJ'}

def _conn():
    return pymssql.connect(**DB)


def get_ap(de='2026-01-01', ate='2026-06-30'):
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
    ) t
    GROUP BY Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, Origem
    ORDER BY Data, Empresa, Obra
    """
    with _conn() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(sql, (de, ate))
        rows = cur.fetchall()
    return [
        {
            'empresa':   r['Empresa'] or '',
            'obra':      r['Obra'] or '',
            'data':      r['Data'] or '',
            'fornecedor': (r['Fornecedor'] or '').strip(),
            'banco':     r['Banco'] or '',
            'conta':     r['Conta'] or '',
            'categoria': r['Categoria'] or '',
            'valor':     float(r['Valor'] or 0),
            'origem':    r['Origem'] or '',
        }
        for r in rows
    ]


def get_receitas(de='2026-01-01', ate='2026-06-30'):
    sql = """
    SELECT Empresa, Obra, Cliente, Tipo, Data, DataVenc, Valor, Status, Banco, Conta
    FROM (
        -- Parcelas a receber (em aberto)
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

        -- Recebidas via VWBI_Receitas (empresas cobertas — valores com correção)
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
            '' AS Banco,
            '' AS Conta
        FROM VWBI_Receitas v
        WHERE v.StatusPL = 'REALIZADO'
          AND v.[Valor recebido] > 0
          AND v.Data BETWEEN %s AND %s

        UNION ALL

        -- Recebidas via tabela Recebidas (empresas não cobertas pela VWBI)
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
            ISNULL(CAST(r.NumeroBanco_rec AS VARCHAR), '') AS Banco,
            ISNULL(r.ContaBanco_rec, '') AS Conta
        FROM Recebidas r
        LEFT JOIN Pessoas p ON p.cod_pes = r.Cliente_Rec
        WHERE r.Status_Rec = 1
          AND r.Data_Rec BETWEEN %s AND %s
          AND r.Empresa_rec NOT IN (SELECT DISTINCT Empresa FROM VWBI_Receitas)
    ) t
    ORDER BY Data, Empresa, Obra
    """
    with _conn() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(sql, (de, ate, de, ate, de, ate))
        rows = cur.fetchall()
    return [
        {
            'empresa':   r['Empresa'] or '',
            'obra':      r['Obra'] or '',
            'cliente':   (r['Cliente'] or '').strip(),
            'tipo':      r['Tipo'] or '',
            'data':      r['Data'] or '',
            'data_venc': r['DataVenc'] or '',
            'valor':     float(r['Valor'] or 0),
            'status':    r['Status'] or '',
            'banco':     str(r['Banco'] or '').strip(),
            'conta':     str(r['Conta'] or '').strip(),
        }
        for r in rows
    ]


def get_saldo_banco(de='2020-01-01', ate='2030-12-31'):
    sql = """
    SELECT
        CASE Empresa_sdcc
            WHEN 1 THEN 'COMBRASEN' WHEN 3 THEN 'DRESDEN'
            WHEN 4 THEN 'TRUST'     WHEN 5 THEN 'GAMA 01'
            WHEN 6 THEN 'CONSÓRCIO HMSJ'
        END AS Empresa,
        CONVERT(varchar, Data_sdcc, 103) AS Data,
        SUM(Saldo_sdcc) AS Saldo
    FROM SaldoConta
    WHERE Data_sdcc BETWEEN %s AND %s
      AND Empresa_sdcc IN (1, 3, 4, 5, 6)
    GROUP BY Empresa_sdcc, Data_sdcc
    ORDER BY Data_sdcc, Empresa_sdcc
    """
    with _conn() as conn:
        cur = conn.cursor(as_dict=True)
        cur.execute(sql, (de, ate))
        rows = cur.fetchall()
    return [
        {
            'empresa': r['Empresa'] or '',
            'data':    r['Data'] or '',
            'saldo':   float(r['Saldo'] or 0),
        }
        for r in rows
    ]
