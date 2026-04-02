from fastapi import APIRouter
from app.api.financeiro import router as financeiro_router
from app.api.sync import router as sync_router
from app.api.filters import router as filters_router

router = APIRouter(prefix="/api")
router.include_router(financeiro_router)
router.include_router(sync_router)
router.include_router(filters_router)
