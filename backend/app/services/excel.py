"""
Leitura de planilhas Excel via SMB — migrado de excel_sync.py.
"""
import io
import logging
from datetime import datetime, date

from app.config import settings

log = logging.getLogger(__name__)


def _parse_unc(unc_path: str) -> tuple[str, str, str]:
    """\\\\server\\share\\path\\file  ->  (server, share, remote_path)"""
    clean = unc_path.replace("/", "\\").lstrip("\\")
    parts = clean.split("\\")
    server = parts[0]
    share = parts[1]
    remote = "\\" + "\\".join(parts[2:])
    return server, share, remote


def _read_smb(unc_path: str, username: str = "", password: str = "") -> io.BytesIO:
    from smb.SMBConnection import SMBConnection

    server, share, remote_path = _parse_unc(unc_path)
    
    # Suporte nativo ao formato DOMINIO\usuario muito usado no Windows Server
    domain = ""
    if "\\" in username:
        domain, username = username.split("\\", 1)

    conn = SMBConnection(
        username,
        password,
        "dashfinance",
        server,
        domain=domain,
        use_ntlm_v2=True,
        is_direct_tcp=True,
    )
    if not conn.connect(server, 445, timeout=10):
        raise ConnectionError(f"SMB: falha ao conectar em {server}")
    buf = io.BytesIO()
    conn.retrieveFile(share, remote_path, buf)
    conn.close()
    buf.seek(0)
    return buf


def _fmt_date(val) -> str | None:
    """Converte valor de celula Excel (datetime / date / string) -> DD/MM/YYYY."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%d/%m/%Y")
    s = str(val).strip()
    if len(s) == 10 and s[2] == "/" and s[5] == "/":
        return s
    return None


def _parse_excel(buf: io.BytesIO, default_empresa: str) -> tuple[list[dict], list[dict]]:
    """Le a primeira aba da planilha e devolve (ap_records, receitas_records)."""
    import openpyxl

    wb = openpyxl.load_workbook(buf, read_only=True, data_only=True)
    ws = wb.worksheets[0]

    ap, rec = [], []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 9:
            continue

        _emp, tipo, obra, forn_cli, valor, _doc, _ori, _stat, data_val = row[:9]

        tipo = str(tipo or "").strip()
        if tipo not in ("Entrada", "Saída", "Saida"):
            continue

        data_str = _fmt_date(data_val)
        if not data_str:
            continue

        valor = float(valor) if valor else 0.0
        obra = str(obra or "").strip()
        forn_cli = str(forn_cli or "").strip()

        if tipo in ("Saída", "Saida"):
            ap.append(
                {
                    "empresa": default_empresa,
                    "obra": obra,
                    "data": data_str,
                    "fornecedor": forn_cli,
                    "banco": "",
                    "conta": "",
                    "categoria": "Planilha",
                    "valor": valor,
                    "origem": "A Confirmar",
                }
            )
        else:
            rec.append(
                {
                    "empresa": default_empresa,
                    "obra": obra,
                    "cliente": forn_cli,
                    "tipo": "",
                    "data": data_str,
                    "data_venc": data_str,
                    "valor": valor,
                    "status": "A Receber",
                    "banco": "",
                    "conta": "",
                }
            )

    wb.close()
    return ap, rec


def get_excel_data() -> tuple[list[dict], list[dict]]:
    """
    Le as planilhas COMBRASEN e GAMA 01 via SMB e devolve (ap_list, receitas_list).
    Falhas individuais sao ignoradas (log de aviso); nunca lanca excecao.
    """
    arquivos = [
        (settings.EXCEL_COMBRASEN, "COMBRASEN"),
        (settings.EXCEL_GAMA01, "GAMA 01"),
    ]
    username = settings.EXCEL_SMB_USER
    password = settings.EXCEL_SMB_PASS

    all_ap: list[dict] = []
    all_rec: list[dict] = []
    for unc_path, empresa in arquivos:
        try:
            buf = _read_smb(unc_path, username, password)
            ap, rec = _parse_excel(buf, empresa)
            all_ap.extend(ap)
            all_rec.extend(rec)
            log.info("Excel sync [%s]: %d saidas, %d entradas", empresa, len(ap), len(rec))
        except Exception as exc:
            log.warning("Excel sync ignorado [%s]: %s", empresa, exc)

    return all_ap, all_rec
