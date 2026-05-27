"""
TruthLens Backend — FastAPI Application

Enterprise-grade REST API for deepfake media detection.
Provides:
- Media upload & URL scanning (image, audio, video)
- Hybrid AI detection pipeline (fast heuristics + deep models)
- Detection history & analytics
- Domain reputation tracking
- Monthly auto-cleanup of expired records
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from core.config import get_settings
from core.database import engine, Base
from api import detection, health

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TruthLens API server...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
    yield
    logger.info("Shutting down TruthLens API server...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routes
app.include_router(health.router, prefix="/api/v1")
app.include_router(detection.router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info",
    )
