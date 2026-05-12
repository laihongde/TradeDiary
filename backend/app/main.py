from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import analyses, market_data, statistics

app = FastAPI(title="股票分析追蹤系統", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyses.router, prefix="/api/analyses", tags=["analyses"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["statistics"])
app.include_router(market_data.router, prefix="/api/market", tags=["market"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
