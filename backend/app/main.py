from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.core import router as core_router
from app.api.feedback import router as feedback_router
from app.api.questions import router as questions_router
from app.api.realtime import router as realtime_router
from app.api.resumes import router as resumes_router
from app.config import get_settings


logging.getLogger("whisperlivekit").setLevel(logging.ERROR)
logging.getLogger("uvicorn").setLevel(logging.ERROR)
logging.getLogger("uvicorn.access").setLevel(logging.ERROR)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Resume Parser API",
        description="API for parsing resumes and extracting structured data",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    app.include_router(core_router)
    app.include_router(resumes_router)
    app.include_router(questions_router)
    app.include_router(feedback_router)
    app.include_router(realtime_router)

    return app


app = create_app()
