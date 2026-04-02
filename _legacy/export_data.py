import pymssql, json

conn = pymssql.connect(server='192.168.1.8\\SQLEXPRESS', port=62311, database='uau',
                       user='claude_readonly', password='ClaudeReadOnly2024!')
cursor = conn.cursor(as_dict=True)

sql = """
SELECT Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, SUM(Valor) AS Valor, Origem
FROM (
    SELECT
        CASE v.Empresa_des
            WHEN 1 THEN 'COMBRASEN'
            WHEN 3 THEN 'DRESDEN'
            WHEN 4 THEN 'TRUST'
            WHEN 5 THEN 'GAMA 01'
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
        CASE WHEN v.StatusParc_des = 0 THEN 'Planejamento' ELSE 'Emissao' END AS Origem
    FROM VwDesembolsoAPagar v
    LEFT JOIN Pessoas p ON p.cod_pes = v.CodForn_Des
    LEFT JOIN CategoriasDeMovFin cmf ON cmf.Codigo_cmf = v.CategMovFin_Des
    WHERE v.StatusParc_des IN (0, 1)
      AND v.DtPgto_des BETWEEN '2026-01-01' AND '2026-06-30'
) t
GROUP BY Empresa, Obra, Data, Fornecedor, Banco, Conta, Categoria, Origem
ORDER BY Data, Empresa, Obra
"""

cursor.execute(sql)
rows = cursor.fetchall()
conn.close()

clean = []
for r in rows:
    clean.append({
        'empresa': r['Empresa'] or '',
        'obra': r['Obra'] or '',
        'data': r['Data'] or '',
        'fornecedor': (r['Fornecedor'] or '').strip(),
        'banco': r['Banco'] or '',
        'conta': r['Conta'] or '',
        'categoria': r['Categoria'] or '',
        'valor': float(r['Valor'] or 0),
        'origem': r['Origem'] or ''
    })

datas = sorted(set(r['data'] for r in clean))
print(f'Total: {len(clean)} registros')
print(f'Periodo: {datas[0]} a {datas[-1]}')
print(f'Empresas: {sorted(set(r["empresa"] for r in clean))}')

with open('data_ap.json', 'w', encoding='utf-8') as f:
    json.dump(clean, f, ensure_ascii=False)
print('data_ap.json salvo!')
