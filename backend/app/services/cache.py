import json
import hashlib
import redis.asyncio as aioredis
from app.config import settings

redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


def cache_key(prefix: str, params: dict) -> str:
    param_str = json.dumps(params, sort_keys=True, default=str)
    hash_val = hashlib.md5(param_str.encode()).hexdigest()[:12]
    return f"dash:{prefix}:{hash_val}"


async def get_cached(key: str):
    r = await get_redis()
    data = await r.get(key)
    return json.loads(data) if data else None


async def set_cached(key: str, data, ttl: int | None = None):
    r = await get_redis()
    ttl = ttl or settings.CACHE_TTL_SECONDS
    await r.set(key, json.dumps(data, default=str, ensure_ascii=False), ex=ttl)


async def invalidate_prefix(prefix: str):
    r = await get_redis()
    async for key in r.scan_iter(f"dash:{prefix}:*"):
        await r.delete(key)


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.aclose()
        redis_client = None
