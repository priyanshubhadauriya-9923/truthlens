from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TruthLens API",
        "version": "1.0.0",
    }


@router.get("/")
async def root():
    return {
        "name": "TruthLens API",
        "version": "1.0.0",
        "docs": "/docs",
    }
