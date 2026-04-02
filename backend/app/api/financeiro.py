from fastapi import APIRouter
from app.services.cache import get_cached
from app.services.queries import get_ap, get_receitas, get_saldo_banco
from app.config import settings

router = APIRouter(tags=["financeiro"])


@router.get("/ap")
async def api_ap():
    cached = await get_cached("dash:ap:all")
    if cached is not None:
        return cached
    data = get_ap(settings.SYNC_DATE_FROM, settings.SYNC_DATE_TO)
    return data


@router.get("/receitas")
async def api_receitas():
    cached = await get_cached("dash:receitas:all")
    if cached is not None:
        return cached
    data = get_receitas(settings.SYNC_DATE_FROM, settings.SYNC_DATE_TO)
    return data


@router.get("/saldo_banco")
async def api_saldo_banco():
    cached = await get_cached("dash:saldo:all")
    if cached is not None:
        return cached
    data = get_saldo_banco(settings.SYNC_DATE_FROM, settings.SYNC_DATE_TO)
    return data
