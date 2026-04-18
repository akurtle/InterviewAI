from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional


class QuestionRequest(BaseModel):
    role: Optional[str] = Field(None, description="Target role/title.")
    company: Optional[str] = Field(None, description="Target company (optional).")
    call_type: str = Field(
        "interview",
        description="Type of call (interview, sales, presentation).",
    )
    num_questions: int = Field(10, ge=1, le=30)
    asked_questions: List[str] = Field(
        default_factory=list,
        description="Questions already generated for this session, used to avoid duplicates.",
    )


class QuestionItem(BaseModel):
    category: str
    question: str
    rationale: Optional[str] = None


class QuestionResponse(BaseModel):
    questions: List[QuestionItem]
    warnings: List[str] = []
    used_inputs: List[str] = []
