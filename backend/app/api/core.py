from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(tags=["core"])


@router.get("/")
async def root():
    return {"message": "Interviewer", "status": "active"}


@router.get("/health")
async def health_check():
    return {"status": "healthy"}
