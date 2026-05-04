from __future__ import annotations

import asyncio

from fastapi import APIRouter

from app.questions.models import QuestionRequest, QuestionResponse
from app.questions.question_generator import generate_questions


router = APIRouter(prefix="/questions", tags=["questions"])


@router.post("/generate", response_model=QuestionResponse)
async def questions_generate(request: QuestionRequest):
    # generate_questions uses urllib (blocking I/O) — run in a thread so the
    # event loop stays free to service WebSocket heartbeats and ASR while
    # Gemini is responding.
    questions, warnings, used_inputs = await asyncio.to_thread(generate_questions, request)
    return QuestionResponse(
        questions=questions,
        warnings=warnings,
        used_inputs=used_inputs,
    )
