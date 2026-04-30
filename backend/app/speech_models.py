from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class WordTimestamp(BaseModel):
    word: str = Field(..., description="Recognized word token.")
    start: float = Field(..., description="Start time in seconds.")
    end: float = Field(..., description="End time in seconds.")


class SegmentTimestamp(BaseModel):
    text: str = Field(..., description="Full segment text.")
    start: float = Field(..., description="Segment start time in seconds.")
    end: float = Field(..., description="Segment end time in seconds.")


class QuestionResponseItem(BaseModel):
    index: int = Field(..., ge=0, description="Zero-based question index.")
    question: str = Field(..., description="Prompt shown to the user.")
    category: Optional[str] = Field(None, description="Optional question category.")
    answer_text: str = Field(..., description="Captured answer text for this question.")


class SpeechSample(BaseModel):
    text: Optional[str] = Field(None, description="Full transcript text.")
    words: Optional[List[WordTimestamp]] = Field(
        None, description="Optional word-level timestamps."
    )
    segments: Optional[List[SegmentTimestamp]] = Field(
        None, description="Optional segment-level timestamps."
    )
    question_responses: Optional[List[QuestionResponseItem]] = Field(
        None,
        description="Optional per-question answers captured during the session.",
    )


class QuestionResponseReview(BaseModel):
    index: int
    question: str
    category: Optional[str] = None
    answer_text: str
    score: float
    summary: str
    strengths: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    dimension_scores: Dict[str, float] = Field(default_factory=dict)


class SpeechFeedbackResponse(BaseModel):
    score: float
    metrics: Dict[str, Any]
    feedback: List[str]
    warnings: List[str]
    response_score: Optional[float] = None
    response_metrics: Dict[str, Any] = Field(default_factory=dict)
    response_feedback: List[str] = Field(default_factory=list)
    question_reviews: List[QuestionResponseReview] = Field(default_factory=list)
