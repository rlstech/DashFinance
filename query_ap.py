import pymssql, json

conn = pymssql.connect(server='192.168.1.8\\SQLEXPRESS', port=62311, database='uau',
                       user='claude_readonly', password='ClaudeReadOnly2024!')
cursor = conn.cursor(as_dict=True)

sql = """
SELECT Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, SUM(Valor) AS Valor, Origem
FROM (
    SELECT CAST(v.Empresa_des AS VARCHAR) AS Empresa, CAST(v.Obra_des AS VARCHAR) AS Obra,
        CONVERT(VARCHAR(10), v.DtPgto_des, 103) AS Data,
        p.nome_pes AS Fornecedor,
        CAST(v.Banco_des AS VARCHAR) AS Banco, v.ContaCorr_des AS Conta,
        ISNULL(cmf.Desc_cmf, 'S/Categoria') AS Categoria,
        v.TotalLiq_des AS Valor,
        CASE WHEN v.StatusParc_des = 0 THEN 'Planejamento' ELSE 'Emissao' END AS Origem
    FROM VwDesembolsoAPagar v
    LEFT JOIN Pessoas p ON p.cod_pes = v.CodForn_Des
    LEFT JOIN CategoriasDeMovFin cmf ON cmf.Codigo_cmf = v.CategMovFin_Des
    WHERE v.DtPgto_des BETWEEN '2026-03-20' AND '2026-03-31'
      AND v.StatusParc_des IN (0, 1)
    UNION ALL
    SELECT CAST(cp.Empresa_pag AS VARCHAR), CAST(cp.ObraProc_Pag AS VARCHAR),
        CONVERT(VARCHAR(10), ISNULL(pr.Data_Pro, cp.DataVencParc_Pag), 103),
        p.nome_pes, CAST(cp.BancoProc_Pag AS VARCHAR), cp.Conta_Pag,
        ISNULL(cmf.Desc_cmf, 'S/Categoria'),
        cp.ValorProc_Pag, 'Emissao'
    FROM ContasPagas cp
    LEFT JOIN Pessoas p ON p.cod_pes = cp.CodForn_Pag
    LEFT JOIN CategoriasDeMovFin cmf ON cmf.Codigo_cmf = cp.CategMovFin_Pag
    LEFT JOIN (SELECT Empresa_pro, NumProc_Pro, NumParc_Pro, MAX(Data_Pro) AS Data_Pro
        FROM Prorroga GROUP BY Empresa_pro, NumProc_Pro, NumParc_Pro) pr
        ON pr.Empresa_pro=cp.Empresa_pag AND pr.NumProc_Pro=cp.NumProc_Pag AND pr.NumParc_Pro=cp.NumParc_Pag
    WHERE ISNULL(pr.Data_Pro, cp.DataVencParc_Pag) BETWEEN '2026-03-20' AND '2026-03-31'
      AND cp.Status_Pag = 0
      AND NOT EXISTS (SELECT 1 FROM VwDesembolsoAPagar v2
          WHERE v2.Empresa_des=cp.Empresa_pag AND v2.NumProc_des=cp.NumProc_Pag AND v2.NumParc_des=cp.NumParc_Pag)
) t
GROUP BY Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, Origem
ORDER BY Empresa, Obra, Data
"""

cursor.execute(sql)
rows = cursor.fetchall()
conn.close()

print(json.dumps(rows, default=str))
