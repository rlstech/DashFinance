from pydantic import BaseModel


class APRecord(BaseModel):
    empresa: str = ""
    obra: str = ""
    data: str = ""
    fornecedor: str = ""
    banco: str = ""
    conta: str = ""
    categoria: str = ""
    valor: float = 0.0
    origem: str = ""


class ReceitaRecord(BaseModel):
    empresa: str = ""
    obra: str = ""
    cliente: str = ""
    tipo: str = ""
    data: str = ""
    data_venc: str = ""
    valor: float = 0.0
    status: str = ""
    banco: str = ""
    conta: str = ""


class SaldoRecord(BaseModel):
    empresa: str = ""
    banco: str = ""
    conta: str = ""
    data: str = ""
    saldo: float = 0.0


class SyncResponse(BaseModel):
    ok: bool
    errors: list[str] = []
    last_sync: str | None = None
    count_ap: int = 0
    count_receitas: int = 0
    count_saldo: int = 0


class StatusResponse(BaseModel):
    last_sync: str | None = None
    de: str | None = None
    ate: str | None = None
    count_ap: int = 0
    count_receitas: int = 0
    count_saldo: int = 0


class FilterTree(BaseModel):
    empresas: list[str] = []
    obras_por_empresa: dict[str, list[str]] = {}
    bancos_por_empresa: dict[str, list[str]] = {}
    contas_por_empresa: dict[str, list[str]] = {}
    contas_por_empresa_banco: dict[str, dict[str, list[str]]] = {}
