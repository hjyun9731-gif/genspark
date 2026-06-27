"""
FastAPI 진입점 (main)
---------------------
- 라우터 등록(/api/*)
- /api/health  (DB 불필요, 배포 헬스체크용)
- 빌드된 프론트(static) 가 있으면 서빙. 없으면 API 만 동작.
- 스키마 생성/초기화는 하지 않는다(Alembic 담당, 데이터 보존 정책).
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, engine
from .routers import closures, dashboard, deposits, exclusion_rules, imports, members, pending, payments, public_lookup

settings = get_settings()

import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("misu")

app = FastAPI(title=settings.app_name)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = int((time.time() - start) * 1000)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터
for r in (members, deposits, closures, pending, dashboard, imports, payments, public_lookup, exclusion_rules):
    app.include_router(r.router)


def _safe_migrate():
    """기존 테이블에 누락된 컬럼을 안전하게 추가한다 (IF NOT EXISTS 스타일)."""
    from sqlalchemy import text
    migrations = [
        # misu_closures: collect_status, last_notice_date, notify_later
        ("misu_closures", "collect_status", "VARCHAR(20) DEFAULT '안내전'"),
        ("misu_closures", "last_notice_date", "DATE"),
        ("misu_closures", "notify_later", "BOOLEAN DEFAULT FALSE"),
    ]
    with engine.connect() as conn:
        for table, col, col_def in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_def}"))
                conn.commit()
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                    conn.commit()
                except Exception:
                    conn.rollback()


@app.on_event("startup")
def create_missing_tables_only():
    """운영 편의용 안전 초기화.
    DROP/TRUNCATE/DELETE 없이 없는 테이블만 생성한다.
    Railway 첫 배포에서 Alembic 버전 파일이 비어 있어도 업로드 기능이 바로 동작하게 한다.
    """
    Base.metadata.create_all(bind=engine)
    _safe_migrate()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


# ---- 프론트 정적 서빙 (빌드 산출물이 있을 때만) ----
STATIC_DIR = Path(__file__).resolve().parent / "static"

# JSX/JS 파일은 브라우저 캐시를 막아 항상 최신 버전을 받게 한다.
_NO_CACHE_EXTS = {".jsx", ".js", ".html"}

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            resp = FileResponse(candidate)
            if Path(full_path).suffix in _NO_CACHE_EXTS:
                resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
                resp.headers["Pragma"] = "no-cache"
            return resp
        resp = FileResponse(STATIC_DIR / "index.html")
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return resp