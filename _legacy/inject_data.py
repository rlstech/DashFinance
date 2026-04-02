import json, re

with open('data_ap.json', encoding='utf-8') as f:
    data = json.load(f)

with open('dashboard.html', encoding='utf-8') as f:
    html = f.read()

json_str = json.dumps(data, ensure_ascii=False)
new_line = f'const ALL_DATA = {json_str};'
html = re.sub(r'const ALL_DATA = \[.*?\];', new_line, html, count=1, flags=re.DOTALL)

with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Dashboard gerado com {len(data)} registros!")
print(f"Tamanho: {len(html)/1024:.0f} KB")
