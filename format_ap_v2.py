import pymssql
from collections import defaultdict

conn = pymssql.connect(server='192.168.1.8\\SQLEXPRESS', port=62311, database='uau',
                       user='claude_readonly', password='ClaudeReadOnly2024!')
cursor = conn.cursor(as_dict=True)

sql = """
SELECT Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, SUM(Valor) AS Valor, Origem
FROM (
    SELECT CAST(v.Empresa_des AS VARCHAR) AS Empresa, CAST(v.Obra_des AS VARCHAR) AS Obra,
        CONVERT(VARCHAR(10),
            CASE WHEN v.StatusParc_des = 0 THEN v.DtPgto_des
                 ELSE ISNULL(pr.Data_Pro, v.DataVencimento_Des)
            END, 103) AS Data,
        p.nome_pes AS Fornecedor,
        CAST(v.Banco_des AS VARCHAR) AS Banco, v.ContaCorr_des AS Conta,
        ISNULL(cmf.Desc_cmf, 'S/Categoria') AS Categoria,
        v.TotalLiq_des AS Valor,
        CASE WHEN v.StatusParc_des = 0 THEN 'Planejamento' ELSE 'Emissao' END AS Origem
    FROM VwDesembolsoAPagar v
    LEFT JOIN Pessoas p ON p.cod_pes = v.CodForn_Des
    LEFT JOIN CategoriasDeMovFin cmf ON cmf.Codigo_cmf = v.CategMovFin_Des
    LEFT JOIN (SELECT Empresa_pro, NumProc_Pro, NumParc_Pro, MAX(Data_Pro) AS Data_Pro
               FROM Prorroga GROUP BY Empresa_pro, NumProc_Pro, NumParc_Pro) pr
        ON pr.Empresa_pro=v.Empresa_des AND pr.NumProc_Pro=v.NumProc_des AND pr.NumParc_Pro=v.NumParc_des
    WHERE v.StatusParc_des IN (0, 1)
      AND (
          (v.StatusParc_des = 0 AND v.DtPgto_des BETWEEN '2026-03-20' AND '2026-03-31')
          OR
          (v.StatusParc_des = 1 AND ISNULL(pr.Data_Pro, v.DataVencimento_Des) BETWEEN '2026-03-20' AND '2026-03-31')
      )

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

data = defaultdict(lambda: defaultdict(list))
for r in rows:
    data[r['Empresa']][r['Obra']].append(r)

empresas = sorted(data.keys())
grand_total = 0.0

for emp in empresas:
    obras = sorted(data[emp].keys())
    emp_total = sum(float(r['Valor']) for obra in obras for r in data[emp][obra])
    grand_total += emp_total

    print(f"\n{'='*120}")
    print(f"EMPRESA {emp}  |  Total: R$ {emp_total:,.2f}")
    print(f"{'='*120}")

    for obra in obras:
        registros = data[emp][obra]
        obra_total = sum(float(r['Valor']) for r in registros)

        print(f"\n  Obra: {obra}  (Subtotal: R$ {obra_total:,.2f})")
        print(f"  {'-'*116}")
        print(f"  {'Data':<12} {'Fornecedor':<45} {'Banco':<6} {'Conta':<15} {'Categoria':<30} {'Valor':>14} {'Orig':<12}")
        print(f"  {'-'*116}")

        for r in registros:
            forn = (r['Fornecedor'] or '')[:44]
            cat = (r['Categoria'] or '')[:29]
            banco = (r['Banco'] or '')[:5]
            conta = (r['Conta'] or '')[:14]
            valor = float(r['Valor'])
            orig = r['Origem'][:11]
            print(f"  {r['Data']:<12} {forn:<45} {banco:<6} {conta:<15} {cat:<30} {valor:>14,.2f} {orig:<12}")

print(f"\n{'='*120}")
print(f"TOTAL GERAL: R$ {grand_total:,.2f}")
print(f"{'='*120}")
print(f"\nTotal de registros: {len(rows)}")
