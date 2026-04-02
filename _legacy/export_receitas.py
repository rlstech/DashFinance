import pymssql, json

conn = pymssql.connect(server='192.168.1.8\\SQLEXPRESS', port=62311, database='uau',
                       user='claude_readonly', password='ClaudeReadOnly2024!')
cursor = conn.cursor(as_dict=True)

sql = """
SELECT Empresa, Obra, Cliente, Tipo, Data, DataVenc, Valor, Status
FROM (
    -- Parcelas a receber (em aberto)
    SELECT
        CASE cr.Empresa_prc
            WHEN 1 THEN 'COMBRASEN'
            WHEN 3 THEN 'DRESDEN'
            WHEN 4 THEN 'TRUST'
            WHEN 5 THEN 'GAMA 01'
            WHEN 6 THEN 'CONSÓRCIO HMSJ'
            ELSE CAST(cr.Empresa_prc AS VARCHAR)
        END AS Empresa,
        CAST(cr.Obra_Prc AS VARCHAR) AS Obra,
        ISNULL(p.nome_pes, '') AS Cliente,
        cr.Tipo_Prc AS Tipo,
        CONVERT(VARCHAR(10), cr.DataPror_Prc, 103) AS Data,
        CONVERT(VARCHAR(10), cr.DataPror_Prc, 103) AS DataVenc,
        cr.Valor_Prc AS Valor,
        'A Receber' AS Status
    FROM ContasReceber cr
    LEFT JOIN Pessoas p ON p.cod_pes = cr.Cliente_Prc
    WHERE cr.Status_Prc = 0
      AND cr.DataPror_Prc BETWEEN '2026-01-01' AND '2026-06-30'

    UNION ALL

    -- Recebidas: empresas cobertas pela VWBI_Receitas (valores com correção monetária)
    SELECT
        CASE v.Empresa
            WHEN 1 THEN 'COMBRASEN'
            WHEN 3 THEN 'DRESDEN'
            WHEN 4 THEN 'TRUST'
            WHEN 5 THEN 'GAMA 01'
            WHEN 6 THEN 'CONSÓRCIO HMSJ'
            ELSE CAST(v.Empresa AS VARCHAR)
        END AS Empresa,
        CAST(v.Obra AS VARCHAR) AS Obra,
        ISNULL(v.[Nome cliente], '') AS Cliente,
        v.[Tipo parcela] AS Tipo,
        CONVERT(VARCHAR(10), v.Data, 103) AS Data,
        CONVERT(VARCHAR(10), v.Data, 103) AS DataVenc,
        v.[Valor recebido] AS Valor,
        'Recebida' AS Status
    FROM VWBI_Receitas v
    WHERE v.StatusPL = 'REALIZADO'
      AND v.[Valor recebido] > 0
      AND v.Data BETWEEN '2026-01-01' AND '2026-06-30'

    UNION ALL

    -- Recebidas: empresas NÃO cobertas pela VWBI_Receitas
    SELECT
        CASE r.Empresa_rec
            WHEN 1 THEN 'COMBRASEN'
            WHEN 3 THEN 'DRESDEN'
            WHEN 4 THEN 'TRUST'
            WHEN 5 THEN 'GAMA 01'
            WHEN 6 THEN 'CONSÓRCIO HMSJ'
            ELSE CAST(r.Empresa_rec AS VARCHAR)
        END AS Empresa,
        CAST(r.Obra_Rec AS VARCHAR) AS Obra,
        ISNULL(p.nome_pes, '') AS Cliente,
        r.Tipo_Rec AS Tipo,
        CONVERT(VARCHAR(10), r.Data_Rec, 103) AS Data,
        CONVERT(VARCHAR(10), r.DataVenci_Rec, 103) AS DataVenc,
        r.ValorConf_Rec AS Valor,
        'Recebida' AS Status
    FROM Recebidas r
    LEFT JOIN Pessoas p ON p.cod_pes = r.Cliente_Rec
    WHERE r.Status_Rec = 1
      AND r.Data_Rec BETWEEN '2026-01-01' AND '2026-06-30'
      AND r.Empresa_rec NOT IN (SELECT DISTINCT Empresa FROM VWBI_Receitas)
) t
ORDER BY Data, Empresa, Obra
"""

cursor.execute(sql)
rows = cursor.fetchall()
conn.close()

clean = []
for r in rows:
    clean.append({
        'empresa':   r['Empresa'] or '',
        'obra':      r['Obra'] or '',
        'cliente':   (r['Cliente'] or '').strip(),
        'tipo':      r['Tipo'] or '',
        'data':      r['Data'] or '',
        'data_venc': r['DataVenc'] or '',
        'valor':     float(r['Valor'] or 0),
        'status':    r['Status'] or ''
    })

a_receber = [r for r in clean if r['status'] == 'A Receber']
recebidas = [r for r in clean if r['status'] == 'Recebida']

datas = sorted(set(r['data'] for r in clean))
print(f'Total: {len(clean)} registros')
print(f'  A Receber: {len(a_receber)} | Recebidas: {len(recebidas)}')
print(f'Periodo: {datas[0]} a {datas[-1]}')
print(f'Empresas: {sorted(set(r["empresa"] for r in clean))}')

with open('data_receitas.json', 'w', encoding='utf-8') as f:
    json.dump(clean, f, ensure_ascii=False)
print('data_receitas.json salvo!')
