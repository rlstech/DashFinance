import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.config import settings
from app.services.sync import start_scheduler, sync_all
from app.services.cache import close_redis

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting DashFinance API v2.0")
    start_scheduler()
    try:
        await sync_all()
    except Exception as e:
        log.warning("Sync inicial falhou (app continua sem dados): %s", e)
    yield
    await close_redis()
    log.info("Shutting down DashFinance API")


app = FastAPI(
    title="DashFinance API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
