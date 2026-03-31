import io
import os
import logging
from datetime import datetime, date

log = logging.getLogger(__name__)


def _parse_unc(unc_path):
    """\\\\server\\share\\path\\file  →  (server, share, remote_path)"""
    clean = unc_path.replace('/', '\\').lstrip('\\')
    parts = clean.split('\\')
    server = parts[0]
    share  = parts[1]
    remote = '\\' + '\\'.join(parts[2:])
    return server, share, remote


def _read_smb(unc_path, username='', password=''):
    from smb.SMBConnection import SMBConnection
    server, share, remote_path = _parse_unc(unc_path)
    conn = SMBConnection(
        username, password,
        'dashfinance', server,
        use_ntlm_v2=True,
        is_direct_tcp=True,
    )
    if not conn.connect(server, 445, timeout=10):
        raise ConnectionError(f'SMB: falha ao conectar em {server}')
    buf = io.BytesIO()
    conn.retrieveFile(share, remote_path, buf)
    conn.close()
    buf.seek(0)
    return buf


def _fmt_date(val):
    """Converte valor de célula Excel (datetime / date / string) → DD/MM/YYYY."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime('%d/%m/%Y')
    s = str(val).strip()
    if len(s) == 10 and s[2] == '/' and s[5] == '/':
        return s
    return None


def _parse_excel(buf, default_empresa):
    """Lê a primeira aba da planilha e devolve (ap_records, receitas_records)."""
    import openpyxl
    wb = openpyxl.load_workbook(buf, read_only=True, data_only=True)
    ws = wb.worksheets[0]

    ap, rec = [], []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 9:
            continue

        # A=empresa  B=tipo  C=obra  D=fornecedor/cliente
        # E=valor    F=docfiscal  G=origem  H=statusparc  I=data
        _emp, tipo, obra, forn_cli, valor, _doc, _ori, _stat, data_val = row[:9]

        tipo = str(tipo or '').strip()
        if tipo not in ('Entrada', 'Saída', 'Saida'):
            continue

        data_str = _fmt_date(data_val)
        if not data_str:
            continue

        valor    = float(valor) if valor else 0.0
        obra     = str(obra or '').strip()
        forn_cli = str(forn_cli or '').strip()

        if tipo in ('Saída', 'Saida'):
            ap.append({
                'empresa':    default_empresa,
                'obra':       obra,
                'data':       data_str,
                'fornecedor': forn_cli,
                'banco':      '',
                'conta':      '',
                'categoria':  'Planilha',
                'valor':      valor,
                'origem':     'A Confirmar',
            })
        else:
            rec.append({
                'empresa':   default_empresa,
                'obra':      obra,
                'cliente':   forn_cli,
                'tipo':      '',
                'data':      data_str,
                'data_venc': data_str,
                'valor':     valor,
                'status':    'A Receber',
                'banco':     '',
                'conta':     '',
            })

    wb.close()
    return ap, rec


def get_excel_data():
    """
    Lê as planilhas COMBRASEN e GAMA 01 via SMB e devolve (ap_list, receitas_list).
    Falhas individuais são ignoradas (log de aviso); nunca lança exceção.
    """
    arquivos = [
        (
            os.environ.get(
                'EXCEL_COMBRASEN',
                r'\\192.168.1.8\FINAN\FLUXO DE CAIXA\FLUXO DE CAIXA COMBRASEN 2026.xlsx',
            ),
            'COMBRASEN',
        ),
        (
            os.environ.get(
                'EXCEL_GAMA01',
                r'\\192.168.1.8\FINAN\FLUXO DE CAIXA\FLUXO DE CAIXA GAMA 01 2026.xlsx',
            ),
            'GAMA 01',
        ),
    ]
    username = os.environ.get('EXCEL_SMB_USER', '')
    password = os.environ.get('EXCEL_SMB_PASS', '')

    all_ap, all_rec = [], []
    for unc_path, empresa in arquivos:
        try:
            buf      = _read_smb(unc_path, username, password)
            ap, rec  = _parse_excel(buf, empresa)
            all_ap.extend(ap)
            all_rec.extend(rec)
            log.info('Excel sync [%s]: %d saídas, %d entradas', empresa, len(ap), len(rec))
        except Exception as exc:
            log.warning('Excel sync ignorado [%s]: %s', empresa, exc)

    return all_ap, all_rec
