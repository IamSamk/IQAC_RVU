import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.app_routes import app_api
from app.api.routes import api
from app.core.config import AUTO_SEED

log = logging.getLogger("campusai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if AUTO_SEED:
        try:
            from app.services.seeder import seed_if_empty
            seed_if_empty()
        except Exception as e:  # never block startup on the demo seeder
            log.warning("startup seed skipped: %s", e)
    yield


app = FastAPI(
    title="CampusAI Backend",
    description="Agentic Academic ERP & Adaptive LMS for RV University: Supabase ERP + 4 agents (Pacing/Attention, OCR/Assessment, Knowledge Graph/PYQ, Faculty Co-Pilot).",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(api)
app.include_router(app_api)


@app.get("/", tags=["Health"])
def root():
    return {"service": "CampusAI Backend", "docs": "/docs", "api": "/api/v1"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
