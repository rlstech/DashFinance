from fastapi import APIRouter
from app.services.cache import get_cached
from app.models.schemas import FilterTree

router = APIRouter(tags=["filters"])


@router.get("/filters/tree", response_model=FilterTree)
async def get_filter_tree():
    tree = await get_cached("dash:filters:tree")
    if tree:
        return tree
    return FilterTree()
