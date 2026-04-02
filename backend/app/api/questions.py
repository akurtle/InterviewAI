from __future__ import annotations

from fastapi import APIRouter

from app.questions.models import QuestionRequest, QuestionResponse
from app.questions.question_generator import generate_questions


router = APIRouter(prefix="/questions", tags=["questions"])


@router.post("/generate", response_model=QuestionResponse)
async def questions_generate(request: QuestionRequest):
    questions, warnings, used_inputs = generate_questions(request)
    return QuestionResponse(
        questions=questions,
        warnings=warnings,
        used_inputs=used_inputs,
    )
